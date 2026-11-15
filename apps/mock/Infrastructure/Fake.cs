namespace Mock.Infrastructure;

/// <summary>Deterministic invented demo data (English only). Nothing here comes from a real system.</summary>
public class Fake(int seed)
{
    public readonly Random R = new(seed);

    static readonly string[] Start = ["Bra", "Cor", "Del", "Fen", "Gal", "Hal", "Ker", "Lum", "Mar", "Nor", "Ost", "Pel", "Quin", "Ros", "Sel", "Tav", "Ul", "Ver", "Wes", "Zan", "Ash", "Bel", "Cal", "Dun"];
    static readonly string[] Mid = ["a", "e", "i", "o", "u", "an", "en", "or", "ar", "il", "ul", "es"];
    static readonly string[] End = ["dor", "ford", "mont", "vale", "wick", "ton", "ley", "brook", "dale", "tech", "line", "gate", "field", "stone", "mark", "port"];
    static readonly string[] Trade = ["Industrial", "Components", "Supply", "Metals", "Plastics", "Logistics", "Electronics", "Tooling", "Packaging", "Chemicals", "Systems", "Materials", "Fasteners", "Textiles"];
    static readonly string[] Legal = ["Ltd", "Inc", "GmbH", "AG", "Co.", "LLC", "S.A.", "B.V."];
    static readonly string[] First = ["Alex", "Morgan", "Robin", "Jamie", "Taylor", "Casey", "Jordan", "Riley", "Avery", "Quinn", "Drew", "Sam", "Kai", "Noa", "Eli", "Lou"];
    static readonly string[] Last = ["Harlow", "Penrose", "Whitcombe", "Ardent", "Marlow", "Kestrel", "Fairbank", "Linden", "Thorne", "Ellery", "Corwin", "Hale", "Vance", "Sorrell"];

    public static readonly (string Country, string[] Cities)[] Places =
    [
        ("DE", ["Hamburg", "Munich", "Cologne", "Leipzig"]),
        ("US", ["Chicago", "Denver", "Austin", "Portland"]),
        ("CN", ["Shanghai", "Shenzhen", "Suzhou", "Chengdu"]),
        ("FR", ["Lyon", "Lille", "Nantes"]),
        ("JP", ["Osaka", "Nagoya", "Yokohama"]),
        ("GB", ["Leeds", "Bristol", "Glasgow"]),
        ("IT", ["Turin", "Bologna"]),
        ("NL", ["Utrecht", "Eindhoven"]),
    ];

    public T Pick<T>(IReadOnlyList<T> items) => items[R.Next(items.Count)];
    public bool Chance(double p) => R.NextDouble() < p;
    public int Between(int min, int maxInclusive) => R.Next(min, maxInclusive + 1);
    public decimal Dec(double min, double max, int scale) => DbConventions.Fix((decimal)(min + R.NextDouble() * (max - min)), scale);

    public string Word() => Pick(Start) + Pick(Mid) + Pick(End);
    public string CompanyName() => $"{Word()} {Pick(Trade)} {Pick(Legal)}";
    public string PersonName() => $"{Pick(First)} {Pick(Last)}";
    public string FirstName() => Pick(First);
    public string LastName() => Pick(Last);
    public (string Country, string City) Place() { var p = Pick(Places); return (p.Country, Pick(p.Cities)); }
    public string Phone() => $"+{Between(10, 99)} {Between(100, 999)} {Between(1000, 9999)}";

    public T Weighted<T>(params (T Value, int Weight)[] items)
    {
        var total = items.Sum(i => i.Weight);
        var x = R.Next(total);
        foreach (var (v, w) in items) { if (x < w) return v; x -= w; }
        return items[^1].Value;
    }
}
