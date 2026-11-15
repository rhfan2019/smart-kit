using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.OData.Results;
using Microsoft.AspNetCore.OData.Routing.Attributes;
using Microsoft.AspNetCore.OData.Routing.Controllers;
using Mock.Infrastructure;

namespace Mock.Northwind;

// Read-only service without annotations. $search is rejected by CapabilityEnforcer (no SearchRestrictions).

[ODataRouteComponent("odata/northwind")]
public class CategoriesController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Category> Get() => db.Categories;
    [Query] public SingleResult<Category> Get(int key) => SingleResult.Create(db.Categories.Where(x => x.CategoryID == key));
    [Query] public IQueryable<Product> GetProducts(int key) => db.Products.Where(x => x.CategoryID == key);
}

[ODataRouteComponent("odata/northwind")]
public class SuppliersController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Supplier> Get() => db.Suppliers;
    [Query] public SingleResult<Supplier> Get(int key) => SingleResult.Create(db.Suppliers.Where(x => x.SupplierID == key));
    [Query] public IQueryable<Product> GetProducts(int key) => db.Products.Where(x => x.SupplierID == key);
}

[ODataRouteComponent("odata/northwind")]
public class ProductsController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Product> Get() => db.Products;
    [Query] public SingleResult<Product> Get(int key) => SingleResult.Create(db.Products.Where(x => x.ProductID == key));
    [Query] public SingleResult<Category> GetCategory(int key) => SingleResult.Create(db.Products.Where(x => x.ProductID == key).Select(x => x.Category!));
    [Query] public SingleResult<Supplier> GetSupplier(int key) => SingleResult.Create(db.Products.Where(x => x.ProductID == key).Select(x => x.Supplier!));
    [Query] public IQueryable<OrderDetail> GetOrderDetails(int key) => db.OrderDetails.Where(x => x.ProductID == key);
}

[ODataRouteComponent("odata/northwind")]
public class CustomersController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Customer> Get() => db.Customers;
    [Query] public SingleResult<Customer> Get(string key) => SingleResult.Create(db.Customers.Where(x => x.CustomerID == key));
    [Query] public IQueryable<Order> GetOrders(string key) => db.Orders.Where(x => x.CustomerID == key);
}

[ODataRouteComponent("odata/northwind")]
public class EmployeesController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Employee> Get() => db.Employees;
    [Query] public SingleResult<Employee> Get(int key) => SingleResult.Create(db.Employees.Where(x => x.EmployeeID == key));
    [Query] public IQueryable<Order> GetOrders(int key) => db.Orders.Where(x => x.EmployeeID == key);
}

[ODataRouteComponent("odata/northwind")]
public class OrdersController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<Order> Get() => db.Orders;
    [Query] public SingleResult<Order> Get(int key) => SingleResult.Create(db.Orders.Where(x => x.OrderID == key));
    [Query] public SingleResult<Customer> GetCustomer(int key) => SingleResult.Create(db.Orders.Where(x => x.OrderID == key).Select(x => x.Customer!));
    [Query] public SingleResult<Employee> GetEmployee(int key) => SingleResult.Create(db.Orders.Where(x => x.OrderID == key).Select(x => x.Employee!));
    [Query] public IQueryable<OrderDetail> GetOrderDetails(int key) => db.OrderDetails.Where(x => x.OrderID == key);
}

[ODataRouteComponent("odata/northwind")]
public class OrderDetailsController(NorthwindDb db) : ODataController
{
    [Query] public IQueryable<OrderDetail> Get() => db.OrderDetails;
    [Query] public SingleResult<OrderDetail> Get(int keyOrderID, int keyProductID) =>
        SingleResult.Create(db.OrderDetails.Where(x => x.OrderID == keyOrderID && x.ProductID == keyProductID));
    [Query] public SingleResult<Order> GetOrder(int keyOrderID, int keyProductID) =>
        SingleResult.Create(db.OrderDetails.Where(x => x.OrderID == keyOrderID && x.ProductID == keyProductID).Select(x => x.Order!));
    [Query] public SingleResult<Product> GetProduct(int keyOrderID, int keyProductID) =>
        SingleResult.Create(db.OrderDetails.Where(x => x.OrderID == keyOrderID && x.ProductID == keyProductID).Select(x => x.Product!));
}
