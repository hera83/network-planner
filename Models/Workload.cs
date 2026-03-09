using System.ComponentModel.DataAnnotations;

namespace HomelabNetworkPlanner.Models;

public class Workload
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string WorkloadType { get; set; } = "VM";

    [Required]
    [StringLength(100)]
    public string Category { get; set; } = string.Empty;

    [StringLength(100)]
    public string? HostServer { get; set; }

    public int? VmId { get; set; }

    [StringLength(50)]
    public string? IpAddress { get; set; }

    [StringLength(100)]
    public string? OperatingSystem { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}
