using Microsoft.AspNetCore.OData.Query;

namespace Mock.Infrastructure;

/// <summary>[EnableQuery] with the limits used by every controller of the test services.</summary>
public sealed class QueryAttribute : EnableQueryAttribute
{
    public QueryAttribute()
    {
        MaxTop = 1000;
        MaxExpansionDepth = 4;
        MaxNodeCount = 1000;
        MaxOrderByNodeCount = 20;
        MaxAnyAllExpressionDepth = 3;
    }
}
