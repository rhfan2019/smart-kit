using System.Diagnostics;
using System.Security;
using Microsoft.AspNetCore.OData;
using Microsoft.AspNetCore.OData.Extensions;
using Microsoft.AspNetCore.OData.Query.Expressions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Mock.Infrastructure;
using Mock.Northwind;
using Mock.Purchasing;

// ---------------------------------------------------------------- paths and data files
var argList = args.ToList();
var reset = argList.Remove("--reset");
var root = FindRoot();
var dataDir = Path.Combine(root, "data");
Directory.CreateDirectory(dataDir);
var northwindDb = Path.Combine(dataDir, "northwind.db");
var purchasingSeedDb = Path.Combine(dataDir, "purchasing.seed.db");
var purchasingDb = Path.Combine(dataDir, "purchasing.db");

if (reset)
{
    foreach (var f in Directory.GetFiles(dataDir, "*.db*")) File.Delete(f);
    Console.WriteLine("[mock] --reset: database files deleted");
}
var sw = Stopwatch.StartNew();
if (!File.Exists(northwindDb))
{
    NorthwindSeeder.Create(northwindDb + ".tmp");
    File.Move(northwindDb + ".tmp", northwindDb);
    Console.WriteLine($"[mock] generated {northwindDb} ({sw.ElapsedMilliseconds} ms)");
}
if (!File.Exists(purchasingSeedDb))
{
    sw.Restart();
    PurchasingSeeder.Create(purchasingSeedDb + ".tmp");
    File.Move(purchasingSeedDb + ".tmp", purchasingSeedDb);
    if (File.Exists(purchasingDb)) File.Delete(purchasingDb);
    Console.WriteLine($"[mock] generated {purchasingSeedDb} ({sw.ElapsedMilliseconds} ms)");
}
if (!File.Exists(purchasingDb)) RestorePurchasing();

// ---------------------------------------------------------------- EDM models
var csdlDir = Path.Combine(root, "Csdl");
var northwindModel = CsdlLoader.Load(File.ReadAllText(Path.Combine(csdlDir, "northwind.xml")), NorthwindDb.EdmBindings, "northwind");
var template = File.ReadAllText(Path.Combine(csdlDir, "purchasing.template.xml"));
var purchasingXml = new Dictionary<string, string>();
foreach (var lang in new[] { "en", "zh" })
    purchasingXml[lang] = Labels.Apply(template, Labels.LoadFile(Path.Combine(csdlDir, $"labels.{lang}.json")), lang);
var purchasingEn = CsdlLoader.Load(purchasingXml["en"], PurchasingDb.EdmBindings, "purchasing.en");
var purchasingZh = CsdlLoader.Load(purchasingXml["zh"], PurchasingDb.EdmBindings, "purchasing.zh");
var purchasingMetadata = new Dictionary<string, MetadataDocument> { ["en"] = new(purchasingXml["en"], purchasingEn), ["zh"] = new(purchasingXml["zh"], purchasingZh) };

// ---------------------------------------------------------------- services
var builder = WebApplication.CreateBuilder(argList.ToArray());
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Lang>();
builder.Services.AddDbContext<NorthwindDb>(o => o.UseSqlite($"Data Source={northwindDb}"));
builder.Services.AddDbContext<PurchasingDb>(o => o
    .UseSqlite($"Data Source={purchasingDb}")
    .ReplaceService<IModelCacheKeyFactory, LangModelCacheKeyFactory>());
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var u) && (u.IsLoopback || u.Host == "localhost" || u.Host.EndsWith(".localhost")))
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()
    .WithExposedHeaders("ETag", "OData-Version", "Location", "Preference-Applied")));
builder.Services.AddControllers().AddOData(o => o
    .Select().Expand().Filter().OrderBy().Count().SetMaxTop(1000)
    .AddRouteComponents("odata/northwind", northwindModel)
    .AddRouteComponents("odata/purchasing", purchasingEn, s => s.AddSingleton<ISearchBinder, PurchasingSearchBinder>()));

var app = builder.Build();
app.UseRouting();
app.UseCors();
// Purchasing $metadata: pre-rendered per language (Accept-Language zh* -> Chinese labels, otherwise English).
app.Use(async (ctx, next) =>
{
    if (HttpMethods.IsGet(ctx.Request.Method) && ctx.Request.Path.Equals("/odata/purchasing/$metadata", StringComparison.OrdinalIgnoreCase))
    {
        await purchasingMetadata[Lang.FromHeader(ctx.Request.Headers.AcceptLanguage)].Write(ctx);
        return;
    }
    await next();
});
app.UseMiddleware<CapabilityEnforcer>();
app.MapControllers();

app.MapGet("/", () => Results.Json(new
{
    services = new[] { "/odata/northwind/", "/odata/purchasing/" },
    media = "/media/suppliers/{id}.svg",
    e2e = Environment.GetEnvironmentVariable("E2E") == "1",
}));

app.MapGet("/media/suppliers/{id}.svg", (string id, PurchasingDb db) =>
{
    var name = db.Suppliers.Where(s => s.Supplier == id).Select(s => s.SupplierName).FirstOrDefault();
    var initials = name == null ? id.TrimStart('0').PadLeft(2, '0')[^2..]
        : string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2).Select(w => char.ToUpperInvariant(w[0])));
    uint h = 2166136261;
    foreach (var c in id) h = (h ^ c) * 16777619;
    var hue = h % 360;
    var svg = $"""
        <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="48" fill="hsl({hue},55%,42%)"/>
          <circle cx="48" cy="48" r="40" fill="none" stroke="hsl({(hue + 40) % 360},70%,75%)" stroke-width="3"/>
          <text x="48" y="49" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">{SecurityElement.Escape(initials)}</text>
        </svg>
        """;
    return Results.Text(svg, "image/svg+xml");
});

if (Environment.GetEnvironmentVariable("E2E") == "1")
{
    app.MapPost("/test/reset", () =>
    {
        RestorePurchasing();
        return Results.Json(new { reset = true });
    });
    Console.WriteLine("[mock] E2E=1: POST /test/reset enabled");
}

app.Run();

// Restores the working purchasing database from the pristine seed (SQLite online backup; safe with pooled connections).
void RestorePurchasing()
{
    SqliteConnection.ClearAllPools();
    using var src = new SqliteConnection($"Data Source={purchasingSeedDb};Mode=ReadOnly;Pooling=False");
    using var dst = new SqliteConnection($"Data Source={purchasingDb};Pooling=False");
    src.Open(); dst.Open();
    src.BackupDatabase(dst);
    SqliteConnection.ClearAllPools();
}

static string FindRoot()
{
    if (Environment.GetEnvironmentVariable("MOCK_ROOT") is { Length: > 0 } env) return env;
    foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        for (var d = new DirectoryInfo(start); d != null; d = d.Parent)
            if (File.Exists(Path.Combine(d.FullName, "Mock.csproj"))) return d.FullName;
    throw new InvalidOperationException("Cannot locate apps/mock (Mock.csproj); set MOCK_ROOT.");
}
