using HomelabNetworkPlanner.Models;
using Microsoft.EntityFrameworkCore;

namespace HomelabNetworkPlanner.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<PhysicalServer> Servers => Set<PhysicalServer>();
    public DbSet<Workload> Workloads => Set<Workload>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PhysicalServer>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.HasIndex(x => x.ManagementIp).IsUnique();
        });

        modelBuilder.Entity<Workload>(entity =>
        {
            entity.HasIndex(x => x.VmId).IsUnique();
            entity.HasIndex(x => x.IpAddress).IsUnique();
        });
    }
}
