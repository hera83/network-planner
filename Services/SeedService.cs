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

        if (await _db.Vlans.AnyAsync() || await _db.Servers.AnyAsync() || await _db.Workloads.AnyAsync())
        {
            return;
        }

        _db.Vlans.AddRange(
            new Vlan { Name = "Management", VlanId = 1, Subnet = "10.64.0.0/24", Gateway = "10.64.0.1", Purpose = "UniFi og management interfaces", DhcpRange = "Statisk" },
            new Vlan { Name = "Private", VlanId = 10, Subnet = "10.64.10.0/24", Gateway = "10.64.10.1", Purpose = "Familie, laptops, telefoner, TV", DhcpRange = "10.64.10.100-10.64.10.254" },
            new Vlan { Name = "Servers", VlanId = 20, Subnet = "10.64.20.0/24", Gateway = "10.64.20.1", Purpose = "Servere, Proxmox, VM og containere", DhcpRange = "Statisk" },
            new Vlan { Name = "Guest", VlanId = 30, Subnet = "10.64.30.0/24", Gateway = "10.64.30.1", Purpose = "Gæstenetværk", DhcpRange = "10.64.30.100-10.64.30.254" },
            new Vlan { Name = "IoT", VlanId = 40, Subnet = "10.64.40.0/24", Gateway = "10.64.40.1", Purpose = "IoT på 2.4 GHz", DhcpRange = "10.64.40.100-10.64.40.254" }
        );

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
            new Workload { Name = "UniFi Controller", WorkloadType = "VM", Category = "Infrastructure", HostServer = "Proxmox01", VmId = 100, IpAddress = "10.64.20.30", Vlan = 20, OperatingSystem = "Ubuntu Server", Description = "UniFi network controller" },
            new Workload { Name = "Nginx Proxy Manager", WorkloadType = "LXC", Category = "Infrastructure", HostServer = "Proxmox01", VmId = 700, IpAddress = "10.64.20.40", Vlan = 20, OperatingSystem = "Debian", Description = "Reverse proxy" },
            new Workload { Name = "AiGateway", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 500, IpAddress = "10.64.20.80", Vlan = 20, OperatingSystem = ".NET / Linux", Description = "Gateway til lokale AI services" },
            new Workload { Name = "Ollama", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 501, IpAddress = "10.64.20.81", Vlan = 20, OperatingSystem = "Ubuntu Server", Description = "LLM workloads" },
            new Workload { Name = "Speaches", WorkloadType = "VM", Category = "AI Services", HostServer = "Proxmox02", VmId = 502, IpAddress = "10.64.20.82", Vlan = 20, OperatingSystem = "Ubuntu Server", Description = "STT/TTS workloads" },
            new Workload { Name = "SQL Server", WorkloadType = "VM", Category = "Database", HostServer = "Proxmox01", VmId = 400, IpAddress = "10.64.20.70", Vlan = 20, OperatingSystem = "Windows Server", Description = "Databaseserver" },
            new Workload { Name = "Test Linux", WorkloadType = "VM", Category = "Lab", HostServer = "Proxmox01", VmId = 900, IpAddress = "10.64.20.200", Vlan = 20, OperatingSystem = "Ubuntu Server", Description = "Midlertidig testmaskine" }
        );

        await _db.SaveChangesAsync();
    }
}
