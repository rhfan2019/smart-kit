using System.Linq.Expressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Deltas;
using Microsoft.AspNetCore.OData.Query;
using Microsoft.AspNetCore.OData.Query.Expressions;
using Microsoft.AspNetCore.OData.Results;
using Microsoft.AspNetCore.OData.Routing.Attributes;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Microsoft.OData.UriParser;
using Mock.Infrastructure;

namespace Mock.Purchasing;

public abstract class PurchasingController : ODataController
{
    protected IActionResult Error(int status, string code, string message) =>
        StatusCode(status, new { error = new { code, message } });

    /// <summary>Optimistic concurrency: 412 when If-Match does not match the current ETag.</summary>
    protected static bool IfMatchFails<T>(IQueryable<T> current, ODataQueryOptions<T> options) =>
        options.IfMatch != null && !((IQueryable<T>)options.IfMatch.ApplyTo(current)).Any();

    /// <summary>Sets the ETag response header (same value as @odata.etag: W/"base64(Version)").</summary>
    protected void SetETag(int? version)
    {
        if (version is { } v) Response.Headers.ETag = $"W/\"{Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(v.ToString()))}\"";
    }

    protected IActionResult? RejectFields<T>(Delta<T> delta, params string[] allowed) where T : class
    {
        var bad = delta.GetChangedPropertyNames().Except(allowed).ToList();
        return bad.Count == 0 ? null
            : Error(400, "PropertyNotUpdatable", $"Properties not updatable: {string.Join(", ", bad)}. Updatable: {string.Join(", ", allowed)}.");
    }
}

[ODataRouteComponent("odata/purchasing")]
public class PurchaseOrdersController(PurchasingDb db) : PurchasingController
{
    IQueryable<PurchaseOrderEntity> One(string key) => db.PurchaseOrders.Where(x => x.PurchaseOrder == key);

    [Query] public IQueryable<PurchaseOrderEntity> Get() => db.PurchaseOrders;
    [Query] public SingleResult<PurchaseOrderEntity> Get(string key)
    {
        SetETag(One(key).Select(x => (int?)x.Version).FirstOrDefault());
        return SingleResult.Create(One(key));
    }
    [Query] public IQueryable<PurchaseOrderItemEntity> Get_Item(string key) => db.PurchaseOrderItems.Where(x => x.PurchaseOrder == key);
    [Query] public SingleResult<SupplierEntity> Get_Supplier(string key) => SingleResult.Create(One(key).Select(x => x._Supplier!));
    [Query] public SingleResult<OrderStatusEntity> Get_Status(string key) => SingleResult.Create(One(key).Select(x => x._Status!));
    [Query] public SingleResult<OrderTypeEntity> Get_PurchaseOrderType(string key) => SingleResult.Create(One(key).Select(x => x._PurchaseOrderType!));

    public IActionResult Patch(string key, Delta<PurchaseOrderEntity> delta, ODataQueryOptions<PurchaseOrderEntity> options)
    {
        if (delta == null) return Error(400, "InvalidBody", "Request body is not a valid PurchaseOrder delta.");
        if (RejectFields(delta, "Description", "Notes", "PurchaseOrderType", "PurchasingGroup", "OrderDate") is { } bad) return bad;
        var current = One(key);
        var entity = current.SingleOrDefault();
        if (entity == null) return Error(404, "NotFound", $"PurchaseOrder '{key}' not found.");
        if (IfMatchFails(current, options)) return Error(412, "PreconditionFailed", "The entity was changed by someone else (ETag mismatch).");
        delta.Patch(entity);
        entity.Version++;
        db.SaveChanges();
        SetETag(entity.Version);
        return Updated(entity);
    }
}

[ODataRouteComponent("odata/purchasing")]
public class PurchaseOrderItemsController(PurchasingDb db) : PurchasingController
{
    IQueryable<PurchaseOrderItemEntity> One(string po, int item) => db.PurchaseOrderItems.Where(x => x.PurchaseOrder == po && x.PurchaseOrderItem == item);

    [Query] public IQueryable<PurchaseOrderItemEntity> Get() => db.PurchaseOrderItems;
    [Query] public SingleResult<PurchaseOrderItemEntity> Get(string keyPurchaseOrder, int keyPurchaseOrderItem)
    {
        SetETag(One(keyPurchaseOrder, keyPurchaseOrderItem).Select(x => (int?)x.Version).FirstOrDefault());
        return SingleResult.Create(One(keyPurchaseOrder, keyPurchaseOrderItem));
    }
    [Query] public SingleResult<PurchaseOrderEntity> Get_PurchaseOrder(string keyPurchaseOrder, int keyPurchaseOrderItem) => SingleResult.Create(One(keyPurchaseOrder, keyPurchaseOrderItem).Select(x => x._PurchaseOrder!));
    [Query] public SingleResult<MaterialEntity> Get_Material(string keyPurchaseOrder, int keyPurchaseOrderItem) => SingleResult.Create(One(keyPurchaseOrder, keyPurchaseOrderItem).Select(x => x._Material!));
    [Query] public SingleResult<PlantEntity> Get_Plant(string keyPurchaseOrder, int keyPurchaseOrderItem) => SingleResult.Create(One(keyPurchaseOrder, keyPurchaseOrderItem).Select(x => x._Plant!));
    [Query] public IQueryable<PricingConditionEntity> Get_PricingCondition(string keyPurchaseOrder, int keyPurchaseOrderItem) =>
        db.PricingConditions.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem);
    [Query] public IQueryable<ItemHistoryEntity> Get_History(string keyPurchaseOrder, int keyPurchaseOrderItem) =>
        db.ItemHistory.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem);

    public IActionResult Patch(string keyPurchaseOrder, int keyPurchaseOrderItem, Delta<PurchaseOrderItemEntity> delta, ODataQueryOptions<PurchaseOrderItemEntity> options)
    {
        if (delta == null) return Error(400, "InvalidBody", "Request body is not a valid PurchaseOrderItem delta.");
        if (RejectFields(delta, "DeliveryDate", "Plant") is { } bad) return bad;
        var current = One(keyPurchaseOrder, keyPurchaseOrderItem);
        var entity = current.SingleOrDefault();
        if (entity == null) return Error(404, "NotFound", "PurchaseOrderItem not found.");
        if (IfMatchFails(current, options)) return Error(412, "PreconditionFailed", "The entity was changed by someone else (ETag mismatch).");
        delta.Patch(entity);
        entity.Version++;
        db.SaveChanges();
        SetETag(entity.Version);
        return Updated(entity);
    }
}

[ODataRouteComponent("odata/purchasing")]
public class PricingConditionsController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<PricingConditionEntity> Get() => db.PricingConditions;
    [Query] public SingleResult<PricingConditionEntity> Get(string keyPurchaseOrder, int keyPurchaseOrderItem, int keyConditionCounter) =>
        SingleResult.Create(db.PricingConditions.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem && x.ConditionCounter == keyConditionCounter));
    [Query] public SingleResult<PurchaseOrderItemEntity> Get_Item(string keyPurchaseOrder, int keyPurchaseOrderItem, int keyConditionCounter) =>
        SingleResult.Create(db.PurchaseOrderItems.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem));
}

[ODataRouteComponent("odata/purchasing")]
public class ItemHistoryController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<ItemHistoryEntity> Get() => db.ItemHistory;
    [Query] public SingleResult<ItemHistoryEntity> Get(string keyPurchaseOrder, int keyPurchaseOrderItem, int keyHistoryCounter) =>
        SingleResult.Create(db.ItemHistory.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem && x.HistoryCounter == keyHistoryCounter));
    [Query] public SingleResult<PurchaseOrderItemEntity> Get_Item(string keyPurchaseOrder, int keyPurchaseOrderItem, int keyHistoryCounter) =>
        SingleResult.Create(db.PurchaseOrderItems.Where(x => x.PurchaseOrder == keyPurchaseOrder && x.PurchaseOrderItem == keyPurchaseOrderItem));
}

[ODataRouteComponent("odata/purchasing")]
public class SuppliersController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<SupplierEntity> Get() => db.Suppliers;
    [Query] public SingleResult<SupplierEntity> Get(string key) => SingleResult.Create(db.Suppliers.Where(x => x.Supplier == key));
}

[ODataRouteComponent("odata/purchasing")]
public class MaterialsController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<MaterialEntity> Get() => db.Materials;
    [Query] public SingleResult<MaterialEntity> Get(string key) => SingleResult.Create(db.Materials.Where(x => x.Material == key));
}

[ODataRouteComponent("odata/purchasing")]
public class PlantsController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<PlantEntity> Get() => db.Plants;
    [Query] public SingleResult<PlantEntity> Get(string key) => SingleResult.Create(db.Plants.Where(x => x.Plant == key));
}

[ODataRouteComponent("odata/purchasing")]
public class OrderStatusesController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<OrderStatusEntity> Get() => db.OrderStatuses;
    [Query] public SingleResult<OrderStatusEntity> Get(string key) => SingleResult.Create(db.OrderStatuses.Where(x => x.Code == key));
}

[ODataRouteComponent("odata/purchasing")]
public class PurchaseOrderTypesController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<OrderTypeEntity> Get() => db.PurchaseOrderTypes;
    [Query] public SingleResult<OrderTypeEntity> Get(string key) => SingleResult.Create(db.PurchaseOrderTypes.Where(x => x.Code == key));
}

[ODataRouteComponent("odata/purchasing")]
public class VariantsController(PurchasingDb db) : PurchasingController
{
    [Query] public IQueryable<VariantEntity> Get() => db.Variants;
    [Query] public SingleResult<VariantEntity> Get(Guid key) => SingleResult.Create(db.Variants.Where(x => x.ID == key));

    public IActionResult Post([FromBody] VariantEntity variant)
    {
        if (variant == null || !ModelState.IsValid) return Error(400, "InvalidBody", "Request body is not a valid Variant.");
        if (variant.ID == Guid.Empty) variant.ID = Guid.NewGuid();
        else if (db.Variants.Any(x => x.ID == variant.ID)) return Error(409, "Conflict", $"Variant {variant.ID} already exists.");
        variant.ModifiedAt = Now();
        db.Variants.Add(variant);
        db.SaveChanges();
        return Created(variant);
    }

    public IActionResult Patch(Guid key, Delta<VariantEntity> delta)
    {
        if (delta == null) return Error(400, "InvalidBody", "Request body is not a valid Variant delta.");
        if (RejectFields(delta, "PageKey", "Name", "IsDefault", "AutoApply", "Content") is { } bad) return bad;
        var entity = db.Variants.SingleOrDefault(x => x.ID == key);
        if (entity == null) return Error(404, "NotFound", $"Variant {key} not found.");
        delta.Patch(entity);
        entity.ModifiedAt = Now();
        db.SaveChanges();
        return Updated(entity);
    }

    static DateTimeOffset Now() => DateTimeOffset.FromUnixTimeMilliseconds(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()); // stored with ms precision

    public IActionResult Delete(Guid key)
    {
        var entity = db.Variants.SingleOrDefault(x => x.ID == key);
        if (entity == null) return Error(404, "NotFound", $"Variant {key} not found.");
        db.Variants.Remove(entity);
        db.SaveChanges();
        return NoContent();
    }
}

/// <summary>
/// $search for the searchable sets (PurchaseOrders, Suppliers, Materials): every search term must be
/// contained (case-insensitive) in at least one of the set's search fields; terms combine with AND
/// (OR / NOT from the $search grammar are honoured too).
/// </summary>
public class PurchasingSearchBinder : ISearchBinder
{
    static readonly Dictionary<Type, string[]> Fields = new()
    {
        [typeof(PurchaseOrderEntity)] = ["PurchaseOrder", "Description", "_Supplier.SupplierName"],
        [typeof(SupplierEntity)] = ["Supplier", "SupplierName", "City"],
        [typeof(MaterialEntity)] = ["Material", "MaterialName"],
        [typeof(PurchaseOrderItemEntity)] = ["Material", "_Material.MaterialName", "Plant"],
    };
    static readonly System.Reflection.MethodInfo Contains = typeof(string).GetMethod("Contains", [typeof(string)])!;
    static readonly System.Reflection.MethodInfo ToLower = typeof(string).GetMethod("ToLower", Type.EmptyTypes)!;

    public Expression BindSearch(SearchClause clause, QueryBinderContext context)
    {
        var p = Expression.Parameter(context.ElementClrType, "s");
        if (!Fields.TryGetValue(context.ElementClrType, out var fields))
            return Expression.Lambda(Expression.Constant(false), p);
        var accessors = fields.Select(f => f.Split('.').Aggregate((Expression)p, Expression.Property)).ToList();
        return Expression.Lambda(Bind(clause.Expression, accessors), p);
    }

    static Expression Bind(SingleValueNode node, List<Expression> fields) => node switch
    {
        BinaryOperatorNode { OperatorKind: BinaryOperatorKind.And } b => Expression.AndAlso(Bind(b.Left, fields), Bind(b.Right, fields)),
        BinaryOperatorNode { OperatorKind: BinaryOperatorKind.Or } b => Expression.OrElse(Bind(b.Left, fields), Bind(b.Right, fields)),
        UnaryOperatorNode { OperatorKind: UnaryOperatorKind.Not } u => Expression.Not(Bind(u.Operand, fields)),
        SearchTermNode t => fields
            .Select(f => (Expression)Expression.Call(Expression.Call(f, ToLower), Contains, Expression.Constant(t.Text.ToLowerInvariant())))
            .Aggregate(Expression.OrElse),
        _ => throw new NotSupportedException(node.Kind.ToString()),
    };
}
