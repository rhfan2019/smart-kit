using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Mock.Infrastructure;

/// <summary>Request language ("en" or "zh") taken from Accept-Language.</summary>
public class Lang
{
    public string Code { get; }
    public Lang(string code) => Code = code;
    public Lang(IHttpContextAccessor http) => Code = FromHeader(http.HttpContext?.Request.Headers.AcceptLanguage.ToString());
    public static string FromHeader(string? header) =>
        header != null && header.TrimStart().StartsWith("zh", StringComparison.OrdinalIgnoreCase) ? "zh" : "en";
}

/// <summary>Contexts whose EF model depends on the request language.</summary>
public interface ILangContext { string LangCode { get; } }

public class LangModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime) =>
        (context.GetType(), (context as ILangContext)?.LangCode, designTime);
}

public static class DbConventions
{
    /// <summary>
    /// SQLite has no decimal type. Store decimals as REAL (so comparisons and ORDER BY are numeric)
    /// and on read round to the declared scale and force that scale (99 -> 99.00) so the OData
    /// payload carries the CSDL Scale. Scale comes from [Precision(p, s)] on the CLR property.
    /// DateTimeOffset is stored as UTC Unix milliseconds (INTEGER) so it can be compared and sorted.
    /// </summary>
    public static void Apply(ModelBuilder mb)
    {
        foreach (var et in mb.Model.GetEntityTypes())
        foreach (var p in et.GetProperties())
        {
            var t = Nullable.GetUnderlyingType(p.ClrType) ?? p.ClrType;
            if (t == typeof(decimal))
            {
                var scale = p.GetScale() ?? 2;
                p.SetValueConverter(DecimalConverter(scale));
            }
            else if (t == typeof(DateTimeOffset))
            {
                p.SetValueConverter(new ValueConverter<DateTimeOffset, long>(
                    v => v.ToUnixTimeMilliseconds(),
                    v => DateTimeOffset.FromUnixTimeMilliseconds(v)));
            }
        }
    }

    static readonly Dictionary<int, ValueConverter> Cache = new();
    static ValueConverter DecimalConverter(int scale)
    {
        lock (Cache)
        {
            if (!Cache.TryGetValue(scale, out var c))
            {
                var zero = new decimal(0, 0, 0, false, (byte)scale);
                c = new ValueConverter<decimal, double>(v => (double)v, v => decimal.Round((decimal)v, scale) + zero);
                Cache[scale] = c;
            }
            return c;
        }
    }

    public static decimal Fix(decimal v, int scale) => decimal.Round(v, scale) + new decimal(0, 0, 0, false, (byte)scale);
}

/// <summary>Fast bulk insert for seeding: one prepared INSERT per table, driven by the EF model.</summary>
public static class BulkInsert
{
    public static void Insert<T>(DbContext db, SqliteConnection conn, SqliteTransaction tx, IEnumerable<T> rows) where T : class
    {
        var et = db.Model.FindEntityType(typeof(T)) ?? throw new InvalidOperationException(typeof(T).Name);
        var props = et.GetProperties().Where(p => p.PropertyInfo != null).ToList();
        var table = et.GetTableName();
        var store = StoreObjectIdentifier.Table(table!, et.GetSchema());
        var cols = props.Select(p => p.GetColumnName(store)!).ToList();
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"INSERT INTO \"{table}\" ({string.Join(",", cols.Select(c => $"\"{c}\""))}) VALUES ({string.Join(",", cols.Select((_, i) => "$p" + i))})";
        var pars = cols.Select((_, i) => cmd.Parameters.Add(new SqliteParameter("$p" + i, null))).ToList();
        var converters = props.Select(p => p.GetValueConverter() ?? p.GetTypeMapping().Converter).ToList();
        cmd.Prepare();
        foreach (var row in rows)
        {
            for (var i = 0; i < props.Count; i++)
            {
                var v = props[i].PropertyInfo!.GetValue(row);
                if (v != null && converters[i] != null) v = converters[i]!.ConvertToProvider(v);
                pars[i].Value = v ?? DBNull.Value;
            }
            cmd.ExecuteNonQuery();
        }
    }
}
