using HomelabNetworkPlanner.Data;
using HomelabNetworkPlanner.Models;
using Microsoft.EntityFrameworkCore;

namespace HomelabNetworkPlanner.Services;

public class SeedService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public SeedService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    public async Task SeedAsync()
    {
        var shouldSeed = _configuration.GetValue<bool>("Planner:SeedOnStartup");
        if (!shouldSeed)
        {
            return;
        }

        if (await _db.Servers.AnyAsync() || await _db.Workloads.AnyAsync())
        {
            return;
        }

        _db.Servers.AddRange(
            new PhysicalServer { Name = "USG-Pro-4", Role = "Gateway", Location = "Serverrum", ManagementIp = "10.64.0.1", Notes = "Fiber ind med fast IP" },
            new PhysicalServer { Name = "US-48", Role = "Switch", Location = "Serverrum", ManagementIp = "10.64.0.2" },
            new PhysicalServer { Name = "US-16-PoE-150W", Role = "PoE switch", Location = "Serverrum", ManagementIp = "10.64.0.3" },
            new PhysicalServer { Name = "Lite-8-PoE", Role = "Lab switch", Location = "Kontor", ManagementIp = "10.64.0.4" },
            new PhysicalServer { Name = "Proxmox01", Role = "Hypervisor", Location = "Serverrum", ManagementIp = "10.64.20.10", IloIp = "10.64.0.20", ServerNetworkIp = "10.64.20.10" },
            new PhysicalServer { Name = "Proxmox02", Role = "Hypervisor", Location = "Serverrum", ManagementIp = "10.64.20.11", IloIp = "10.64.0.21", ServerNetworkIp = "10.64.20.11" },
            new PhysicalServer { Name = "NAS", Role = "Storage", Location = "Serverrum", ManagementIp = "10.64.20.20", ServerNetworkIp = "10.64.20.20", Notes = "NAS er en service i server VLAN, ikke hardware management" }
        );

        _db.Workloads.AddRange(
            new Workload { Name = "UniFi Controller", WorkloadType = "VM", Category = "Infrastructure", HostServer = "Proxmox01", VmId = 100, IpAddress = "10.64.20.30", OperatingSystem = "Ubuntu Server", Description = "UniFi network controller" },
            new Workload { Name = "Nginx Proxy Manager", WorkloadType = "LXC", Category = "Infrastructure", HostServer = "Proxmox01", VmId = 700, IpAddress = "10.64.20.40", OperatingSystem = "Debian", Description = "Reverse proxy" },
            new Workload { Name = "AiGateway", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 500, IpAddress = "10.64.20.80", OperatingSystem = ".NET / Linux", Description = "Gateway til lokale AI services" },
            new Workload { Name = "Ollama", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 501, IpAddress = "10.64.20.81", OperatingSystem = "Ubuntu Server", Description = "LLM workloads" },
            new Workload { Name = "Speaches", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 502, IpAddress = "10.64.20.82", OperatingSystem = "Ubuntu Server", Description = "STT/TTS workloads" },
            new Workload { Name = "SQL Server", WorkloadType = "VM", Category = "Database", HostServer = "Proxmox01", VmId = 400, IpAddress = "10.64.20.70", OperatingSystem = "Windows Server", Description = "Databaseserver" },
            new Workload { Name = "Test Linux", WorkloadType = "VM", Category = "Lab", HostServer = "Proxmox01", VmId = 900, IpAddress = "10.64.20.200", OperatingSystem = "Ubuntu Server", Description = "Midlertidig testmaskine" }
        );

        await _db.SaveChangesAsync();
    }
}
