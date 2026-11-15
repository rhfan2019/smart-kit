using System.Security;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Json.Nodes;
using System.Xml;
using System.Xml.Linq;
using Microsoft.OData.Edm;
using Microsoft.OData.Edm.Csdl;
using Microsoft.OData.ModelBuilder;

namespace Mock.Infrastructure;

/// <summary>Loads hand-written CSDL XML and binds the EDM types to CLR classes.</summary>
public static partial class CsdlLoader
{
    // Microsoft.OData.Edm 8.4 rejects <AnnotationPath> as a collection element (it only accepts the
    // attribute form). We parse a copy where such elements become a marked <String> and restore the
    // authored XML when serving $metadata (see MetadataDocument).
    public const string AnnotationPathMarker = "__AnnotationPath__";

    [GeneratedRegex(@"<AnnotationPath>([^<]*)</AnnotationPath>")]
    private static partial Regex AnnotationPathElement();

    public static IEdmModel Load(string xml, IReadOnlyDictionary<string, Type> bindings, string name)
    {
        xml = AnnotationPathElement().Replace(xml, m => $"<String>{AnnotationPathMarker}{m.Groups[1].Value}</String>");
        using var xr = XmlReader.Create(new StringReader(xml));
        // No-resolver overload: references to UI/Common stay unresolved but every annotation is kept
        // and written back verbatim in $metadata. Core/Capabilities/Measures are built into Microsoft.OData.Edm.
        if (!CsdlReader.TryParse(xr, out IEdmModel model, out var errors))
            throw new InvalidOperationException($"{name}: CSDL parse failed\n" + string.Join("\n", errors.Select(e => e.ToString())));
        foreach (var (typeName, clr) in bindings)
        {
            var t = model.FindDeclaredType(typeName) ?? throw new InvalidOperationException($"{name}: type {typeName} not in CSDL");
            model.SetAnnotationValue(t, new ClrTypeAnnotation(clr));
        }
        return model;
    }
}

/// <summary>Replaces {{label:Key}} placeholders in the purchasing CSDL template.</summary>
public static partial class Labels
{
    [GeneratedRegex(@"\{\{label:([A-Za-z0-9_.]+)\}\}")]
    private static partial Regex Placeholder();

    public static Dictionary<string, string> LoadFile(string path) =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path))
        ?? throw new InvalidOperationException($"empty label file {path}");

    public static string Apply(string template, Dictionary<string, string> labels, string lang)
    {
        var missing = new SortedSet<string>();
        var result = Placeholder().Replace(template, m =>
        {
            if (labels.TryGetValue(m.Groups[1].Value, out var v)) return SecurityElement.Escape(v);
            missing.Add(m.Groups[1].Value);
            return m.Value;
        });
        if (missing.Count > 0)
            throw new InvalidOperationException($"labels.{lang}.json is missing keys: {string.Join(", ", missing)}");
        return result;
    }

    public static IEnumerable<string> Keys(string template) =>
        Placeholder().Matches(template).Select(m => m.Groups[1].Value).Distinct();
}

/// <summary>
/// Pre-rendered $metadata. XML is the authored CSDL (after label substitution) served verbatim, because
/// Microsoft.OData.Edm's writer drops annotations on annotations (Common.Text/UI.TextArrangement) and
/// annotations inside records (UI.PartOfPreview). CSDL JSON takes the structural part from the EDM model
/// writer and replaces "$Annotations" with a conversion of the authored XML annotations.
/// </summary>
public sealed class MetadataDocument
{
    static readonly XNamespace Edm = "http://docs.oasis-open.org/odata/ns/edm";
    static readonly XNamespace Edmx = "http://docs.oasis-open.org/odata/ns/edmx";
    public string Xml { get; }
    public string Json { get; }
    readonly Dictionary<string, string> aliases = new();

    public MetadataDocument(string authoredXml, IEdmModel model)
    {
        Xml = System.Text.RegularExpressions.Regex.Replace(authoredXml, @"\s*<!--.*?-->", "", System.Text.RegularExpressions.RegexOptions.Singleline);
        var doc = XDocument.Parse(authoredXml);
        foreach (var inc in doc.Descendants(Edmx + "Include"))
            if (inc.Attribute("Alias") is { } a) aliases[a.Value] = inc.Attribute("Namespace")!.Value;

        using var ms = new MemoryStream();
        using (var jw = new Utf8JsonWriter(ms))
        {
            if (!CsdlWriter.TryWriteCsdl(model, jw, out var errors))
                throw new InvalidOperationException(string.Join("\n", errors));
        }
        var json = JsonNode.Parse(ms.ToArray())!.AsObject();
        foreach (var schema in doc.Descendants(Edm + "Schema"))
        {
            var annotations = new JsonObject();
            foreach (var block in schema.Elements(Edm + "Annotations"))
            {
                var target = block.Attribute("Target")!.Value;
                var obj = annotations[target]?.AsObject() ?? new JsonObject();
                foreach (var ann in block.Elements(Edm + "Annotation")) AddAnnotation(obj, ann, "");
                annotations[target] = obj;
            }
            var ns = schema.Attribute("Namespace")!.Value;
            var schemaJson = json[ns]!.AsObject();
            schemaJson.Remove("$Annotations");
            if (annotations.Count > 0) schemaJson["$Annotations"] = annotations;
        }
        Json = json.ToJsonString(new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
    }

    void AddAnnotation(JsonObject target, XElement ann, string prefix)
    {
        var key = prefix + "@" + ann.Attribute("Term")!.Value + (ann.Attribute("Qualifier") is { } q ? "#" + q.Value : "");
        target[key] = Expr(ann, true);
        foreach (var nested in ann.Elements(Edm + "Annotation")) AddAnnotation(target, nested, key);
    }

    JsonNode? Expr(XElement holder, bool isAnnotation)
    {
        foreach (var a in holder.Attributes())
        {
            var v = a.Value;
            switch (a.Name.LocalName)
            {
                case "String": return v;
                case "Bool": return bool.Parse(v);
                case "Int": return long.Parse(v);
                case "Decimal": return JsonNode.Parse(v);
                case "Float": return double.Parse(v, System.Globalization.CultureInfo.InvariantCulture);
                case "Date" or "DateTimeOffset" or "TimeOfDay" or "Duration" or "Guid": return v;
                case "EnumMember": return Enum(v);
                case "Path" or "PropertyPath" or "NavigationPropertyPath" or "AnnotationPath" or "ModelElementPath":
                    return new JsonObject { ["$" + a.Name.LocalName] = v };
            }
        }
        var child = holder.Elements().FirstOrDefault(e => e.Name.LocalName != "Annotation");
        if (child != null) return Element(child);
        return isAnnotation ? true : null;
    }

    JsonNode? Element(XElement e)
    {
        switch (e.Name.LocalName)
        {
            case "String": return e.Value;
            case "Bool": return bool.Parse(e.Value);
            case "Int": return long.Parse(e.Value);
            case "Decimal": return JsonNode.Parse(e.Value);
            case "EnumMember": return Enum(e.Value);
            case "Path" or "PropertyPath" or "NavigationPropertyPath" or "AnnotationPath" or "ModelElementPath":
                return new JsonObject { ["$" + e.Name.LocalName] = e.Value };
            case "Null": return null;
            case "Collection":
                var arr = new JsonArray();
                foreach (var c in e.Elements()) arr.Add(Element(c));
                return arr;
            case "Record":
                var obj = new JsonObject();
                if (e.Attribute("Type") is { } t) obj["@type"] = Qualify(t.Value);
                foreach (var c in e.Elements())
                {
                    if (c.Name.LocalName == "PropertyValue")
                    {
                        var name = c.Attribute("Property")!.Value;
                        obj[name] = Expr(c, false);
                        foreach (var nested in c.Elements(Edm + "Annotation")) AddAnnotation(obj, nested, name);
                    }
                    else if (c.Name.LocalName == "Annotation") AddAnnotation(obj, c, "");
                }
                return obj;
            default:
                throw new NotSupportedException($"CSDL JSON conversion: expression <{e.Name.LocalName}> not supported");
        }
    }

    // "UI.TextArrangementType/TextFirst" -> "TextFirst"; flags "A/x A/y" -> "x,y" (CSDL JSON 4.01)
    static string Enum(string v) => string.Join(",", v.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(m => m[(m.LastIndexOf('/') + 1)..]));

    string Qualify(string name)
    {
        var dot = name.LastIndexOf('.');
        return dot > 0 && aliases.TryGetValue(name[..dot], out var ns) ? ns + name[dot..] : name;
    }

    /// <summary>Writes the document; JSON when $format=json or Accept prefers application/json.</summary>
    public Task Write(HttpContext ctx)
    {
        var format = ctx.Request.Query["$format"].ToString();
        var accept = ctx.Request.Headers.Accept.ToString();
        var json = format.StartsWith("json", StringComparison.OrdinalIgnoreCase) || format.StartsWith("application/json", StringComparison.OrdinalIgnoreCase)
                   || (format.Length == 0 && accept.Contains("application/json") && !accept.Contains("xml"));
        ctx.Response.Headers["OData-Version"] = "4.0";
        ctx.Response.ContentType = json ? "application/json; charset=utf-8" : "application/xml; charset=utf-8";
        return ctx.Response.WriteAsync(json ? Json : Xml);
    }
}
