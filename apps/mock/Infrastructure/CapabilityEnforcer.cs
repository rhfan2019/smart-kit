using System.Text.Json;
using Microsoft.AspNetCore.OData.Extensions;
using Microsoft.OData.Edm;
using Microsoft.OData.Edm.Vocabularies;
using Microsoft.OData.UriParser;

namespace Mock.Infrastructure;

/// <summary>
/// Rejects (HTTP 400) requests that violate the Capabilities annotations declared on the target entity set:
/// SearchRestrictions/Searchable (default false, so every set without the annotation rejects $search),
/// CountRestrictions/Countable, FilterRestrictions/Filterable + NonFilterableProperties,
/// SortRestrictions/Sortable + NonSortableProperties. Runs after routing, before the controller.
/// </summary>
public class CapabilityEnforcer(RequestDelegate next)
{
    const string Cap = "Org.OData.Capabilities.V1.";
    static readonly JsonSerializerOptions Json = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public async Task InvokeAsync(HttpContext ctx)
    {
        var feature = ctx.ODataFeature();
        if (feature.Path is { } path && feature.Model is { } model && HttpMethods.IsGet(ctx.Request.Method))
        {
            NormalizeSearch(ctx);
            var error = Check(model, path, ctx.Request.Query);
            if (error is { } e)
            {
                await WriteError(ctx, 400, e.Code, e.Message);
                return;
            }
        }
        await next(ctx);
    }

    public static async Task WriteError(HttpContext ctx, int status, string code, string message)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json; odata.metadata=minimal";
        ctx.Response.Headers["OData-Version"] = "4.0";
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(new { error = new { code, message } }, Json));
    }

    static (string Code, string Message)? Check(IEdmModel model, ODataPath path, IQueryCollection query)
    {
        IEdmNavigationSource? source = null;
        foreach (var seg in path)
        {
            source = seg switch
            {
                EntitySetSegment es => es.EntitySet,
                NavigationPropertySegment np => np.NavigationSource,
                KeySegment k => k.NavigationSource,
                SingletonSegment s => s.Singleton,
                _ => source,
            };
        }
        if (source is not IEdmVocabularyAnnotatable target) return null;
        var setName = source.Name;
        var anns = model.FindVocabularyAnnotations(target).ToList();
        IEdmRecordExpression? Record(string term) =>
            anns.FirstOrDefault(a => a.Term.FullName() == Cap + term || a.Term.Name == term && a.Term.Namespace is "Capabilities")?.Value as IEdmRecordExpression;

        string? Q(string name) => query.FirstOrDefault(kv => string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase)).Value.FirstOrDefault();

        // $search
        if (Q("$search") is not null && !Bool(Record("SearchRestrictions"), "Searchable", false))
            return ("SearchNotSupported", $"Entity set '{setName}' does not support $search (Capabilities.SearchRestrictions/Searchable is not true).");

        // $count
        var countRequested = path.LastSegment is CountSegment || string.Equals(Q("$count"), "true", StringComparison.OrdinalIgnoreCase);
        if (countRequested && !Bool(Record("CountRestrictions"), "Countable", true))
            return ("CountNotSupported", $"Entity set '{setName}' is not countable (Capabilities.CountRestrictions/Countable is false).");

        var dict = query.Where(kv => kv.Key.StartsWith('$')).ToDictionary(kv => kv.Key, kv => kv.Value.ToString());
        if (!dict.ContainsKey("$filter") && !dict.ContainsKey("$orderby")) return null;

        var parser = new ODataQueryOptionParser(model, path, dict) { Resolver = new UnqualifiedODataUriResolver { EnableCaseInsensitive = true } };

        if (dict.ContainsKey("$filter"))
        {
            var rec = Record("FilterRestrictions");
            if (!Bool(rec, "Filterable", true))
                return ("FilterNotSupported", $"Entity set '{setName}' does not support $filter.");
            var nonFilterable = Paths(rec, "NonFilterableProperties");
            if (nonFilterable.Count > 0)
            {
                FilterClause? clause = null;
                try { clause = parser.ParseFilter(); } catch { /* syntax errors are reported by [EnableQuery] */ }
                if (clause != null)
                {
                    var used = new HashSet<string>();
                    CollectProperties(clause.Expression, used);
                    var hit = used.FirstOrDefault(nonFilterable.Contains);
                    if (hit != null)
                        return ("PropertyNotFilterable", $"Property '{hit}' of entity set '{setName}' is not filterable (Capabilities.FilterRestrictions/NonFilterableProperties).");
                }
            }
        }

        if (dict.ContainsKey("$orderby"))
        {
            var rec = Record("SortRestrictions");
            if (!Bool(rec, "Sortable", true))
                return ("SortNotSupported", $"Entity set '{setName}' does not support $orderby.");
            var nonSortable = Paths(rec, "NonSortableProperties");
            if (nonSortable.Count > 0)
            {
                OrderByClause? clause = null;
                try { clause = parser.ParseOrderBy(); } catch { }
                for (var c = clause; c != null; c = c.ThenBy)
                {
                    if (c.Expression is SingleValuePropertyAccessNode p && p.Source is ResourceRangeVariableReferenceNode && nonSortable.Contains(p.Property.Name))
                        return ("PropertyNotSortable", $"Property '{p.Property.Name}' of entity set '{setName}' is not sortable (Capabilities.SortRestrictions/NonSortableProperties).");
                }
            }
        }
        return null;
    }

    /// <summary>
    /// Leniency: the OData $search grammar only allows letters in bare words, so "4500000001", "M8" or
    /// "hex-bolt" are syntax errors in Microsoft.OData. SAP back ends accept them, so bare words that are
    /// not pure letters are rewritten into quoted phrases ("4500000001") before the query is parsed.
    /// AND / OR / NOT, parentheses and existing phrases are kept.
    /// </summary>
    static void NormalizeSearch(HttpContext ctx)
    {
        var key = ctx.Request.Query.Keys.FirstOrDefault(k => string.Equals(k, "$search", StringComparison.OrdinalIgnoreCase));
        if (key == null) return;
        var input = ctx.Request.Query[key].ToString();
        var sb = new System.Text.StringBuilder();
        var i = 0;
        while (i < input.Length)
        {
            var c = input[i];
            if (char.IsWhiteSpace(c) || c is '(' or ')') { sb.Append(c); i++; continue; }
            if (c == '"')
            {
                var j = i + 1;
                while (j < input.Length && input[j] != '"') j += input[j] == '\\' ? 2 : 1;
                j = Math.Min(j + 1, input.Length);
                sb.Append(input, i, j - i); i = j; continue;
            }
            var start = i;
            while (i < input.Length && !char.IsWhiteSpace(input[i]) && input[i] is not '(' and not ')' and not '"') i++;
            var word = input[start..i];
            if (word is "AND" or "OR" or "NOT" || word.All(char.IsLetter)) sb.Append(word);
            else sb.Append('"').Append(word.Replace("\\", "\\\\")).Append('"');
        }
        var normalized = sb.ToString();
        if (normalized == input) return;
        var pairs = ctx.Request.Query.SelectMany(kv => kv.Value.Select(v => new KeyValuePair<string, string?>(kv.Key, kv.Key == key ? normalized : v)));
        ctx.Request.QueryString = QueryString.Create(pairs);
    }

    static bool Bool(IEdmRecordExpression? rec, string prop, bool dflt) =>
        rec?.FindProperty(prop)?.Value is IEdmBooleanConstantExpression b ? b.Value : dflt;

    static HashSet<string> Paths(IEdmRecordExpression? rec, string prop)
    {
        var set = new HashSet<string>();
        if (rec?.FindProperty(prop)?.Value is IEdmCollectionExpression coll)
            foreach (var el in coll.Elements.OfType<IEdmPathExpression>())
                set.Add(string.Join("/", el.PathSegments));
        return set;
    }

    /// <summary>Collects names of properties accessed directly on the target entity ($it).</summary>
    static void CollectProperties(QueryNode? node, HashSet<string> acc)
    {
        switch (node)
        {
            case SingleValuePropertyAccessNode p:
                if (p.Source is ResourceRangeVariableReferenceNode) acc.Add(p.Property.Name);
                CollectProperties(p.Source, acc);
                break;
            case BinaryOperatorNode b: CollectProperties(b.Left, acc); CollectProperties(b.Right, acc); break;
            case UnaryOperatorNode u: CollectProperties(u.Operand, acc); break;
            case ConvertNode c: CollectProperties(c.Source, acc); break;
            case SingleValueFunctionCallNode f: foreach (var a in f.Parameters) CollectProperties(a, acc); break;
            case InNode i: CollectProperties(i.Left, acc); break;
            case AnyNode a: CollectProperties(a.Body, acc); break;
            case AllNode a: CollectProperties(a.Body, acc); break;
            case CollectionPropertyAccessNode cp:
                if (cp.Source is ResourceRangeVariableReferenceNode) acc.Add(cp.Property.Name);
                break;
        }
    }
}
