using System.ComponentModel.DataAnnotations;

namespace HomelabNetworkPlanner.Models;

public class PhysicalServer
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Role { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Location { get; set; }

    [Required]
    [StringLength(50)]
    public string ManagementIp { get; set; } = string.Empty;

    [StringLength(50)]
    public string? ServerNetworkIp { get; set; }

    [StringLength(50)]
    public string? IloIp { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }
}
