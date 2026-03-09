using HomelabNetworkPlanner.Data;
using HomelabNetworkPlanner.Models;
using HomelabNetworkPlanner.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddScoped<SeedService>();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "data"));
Directory.CreateDirectory("/app/data");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var allMigrations = db.Database.GetMigrations();
    if (allMigrations.Any())
    {
        await db.Database.MigrateAsync();
    }
    else
    {
        await DbStartupBootstrapper.EnsureSqliteSchemaAsync(db);
    }

    var seeder = scope.ServiceProvider.GetRequiredService<SeedService>();
    await seeder.SeedAsync();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/overview", async (AppDbContext db) =>
{
    var response = new OverviewDto(
        await db.Servers.OrderBy(x => x.Name).ToListAsync(),
        await db.Workloads.OrderBy(x => x.VmId).ThenBy(x => x.Name).ToListAsync());

    return Results.Ok(response);
});

app.MapPost("/api/servers", async (PhysicalServer server, AppDbContext db) =>
{
    var duplicate = await db.Servers.AnyAsync(x => x.Name == server.Name || x.ManagementIp == server.ManagementIp);
    if (duplicate)
    {
        return Results.BadRequest(new { message = "Servernavn eller management IP findes allerede." });
    }

    db.Servers.Add(server);
    await db.SaveChangesAsync();
    return Results.Created($"/api/servers/{server.Id}", server);
});

app.MapPut("/api/servers/{id:int}", async (int id, PhysicalServer input, AppDbContext db) =>
{
    var server = await db.Servers.FindAsync(id);
    if (server is null) return Results.NotFound();

    var duplicate = await db.Servers.AnyAsync(x => x.Id != id && (x.Name == input.Name || x.ManagementIp == input.ManagementIp));
    if (duplicate)
    {
        return Results.BadRequest(new { message = "Servernavn eller management IP findes allerede." });
    }

    server.Name = input.Name.Trim();
    server.Role = input.Role.Trim();
    server.Location = input.Location?.Trim();
    server.ManagementIp = input.ManagementIp.Trim();
    server.ServerNetworkIp = input.ServerNetworkIp?.Trim();
    server.IloIp = input.IloIp?.Trim();
    server.Notes = input.Notes?.Trim();

    await db.SaveChangesAsync();
    return Results.Ok(server);
});

app.MapDelete("/api/servers/{id:int}", async (int id, AppDbContext db) =>
{
    var server = await db.Servers.FindAsync(id);
    if (server is null) return Results.NotFound();

    db.Servers.Remove(server);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapPost("/api/workloads", async (Workload workload, AppDbContext db) =>
{
    if (workload.VmId is not null)
    {
        var vmIdExists = await db.Workloads.AnyAsync(x => x.VmId == workload.VmId);
        if (vmIdExists)
        {
            return Results.BadRequest(new { message = "VM ID findes allerede." });
        }
    }

    var ipExists = !string.IsNullOrWhiteSpace(workload.IpAddress) && await db.Workloads.AnyAsync(x => x.IpAddress == workload.IpAddress);
    if (ipExists)
    {
        return Results.BadRequest(new { message = "IP-adressen findes allerede." });
    }

    db.Workloads.Add(workload);
    await db.SaveChangesAsync();
    return Results.Created($"/api/workloads/{workload.Id}", workload);
});

app.MapPut("/api/workloads/{id:int}", async (int id, Workload input, AppDbContext db) =>
{
    var workload = await db.Workloads.FindAsync(id);
    if (workload is null) return Results.NotFound();

    if (input.VmId is not null)
    {
        var vmIdExists = await db.Workloads.AnyAsync(x => x.Id != id && x.VmId == input.VmId);
        if (vmIdExists)
        {
            return Results.BadRequest(new { message = "VM ID findes allerede." });
        }
    }

    var ipExists = !string.IsNullOrWhiteSpace(input.IpAddress) && await db.Workloads.AnyAsync(x => x.Id != id && x.IpAddress == input.IpAddress);
    if (ipExists)
    {
        return Results.BadRequest(new { message = "IP-adressen findes allerede." });
    }

    workload.Name = input.Name.Trim();
    workload.WorkloadType = input.WorkloadType.Trim();
    workload.Category = input.Category.Trim();
    workload.HostServer = input.HostServer?.Trim();
    workload.VmId = input.VmId;
    workload.IpAddress = input.IpAddress?.Trim();
    workload.OperatingSystem = input.OperatingSystem?.Trim();
    workload.Description = input.Description?.Trim();

    await db.SaveChangesAsync();
    return Results.Ok(workload);
});

app.MapDelete("/api/workloads/{id:int}", async (int id, AppDbContext db) =>
{
    var workload = await db.Workloads.FindAsync(id);
    if (workload is null) return Results.NotFound();

    db.Workloads.Remove(workload);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/api/export", async (AppDbContext db) =>
{
    var response = new OverviewDto(
        await db.Servers.OrderBy(x => x.Name).ToListAsync(),
        await db.Workloads.OrderBy(x => x.VmId).ThenBy(x => x.Name).ToListAsync());

    return Results.Json(response);
});

app.Run();

public record OverviewDto(List<PhysicalServer> Servers, List<Workload> Workloads);

static class DbStartupBootstrapper
{
    public static async Task EnsureSqliteSchemaAsync(AppDbContext db)
    {
        if (!db.Database.IsSqlite())
        {
            await db.Database.EnsureCreatedAsync();
            return;
        }

        await db.Database.OpenConnectionAsync();
        try
        {
            await using var existsCommand = db.Database.GetDbConnection().CreateCommand();
            existsCommand.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Vlans';";
            var tableExists = Convert.ToInt32(await existsCommand.ExecuteScalarAsync()) > 0;
            if (tableExists)
            {
                return;
            }

            // Make EF create script idempotent so it can repair a partially initialized DB.
            var createScript = db.Database.GenerateCreateScript();
            createScript = createScript.Replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ");
            createScript = createScript.Replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ");
            createScript = createScript.Replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");

            await db.Database.ExecuteSqlRawAsync(createScript);
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }
}
