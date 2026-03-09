using System.ComponentModel.DataAnnotations;

namespace HomelabNetworkPlanner.Models;

public class Vlan
{
    public int Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Range(1, 4094)]
    public int VlanId { get; set; }

    [Required]
    [StringLength(50)]
    public string Subnet { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Gateway { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(100)]
    public string? DhcpRange { get; set; }
}
