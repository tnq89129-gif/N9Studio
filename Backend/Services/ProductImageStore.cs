using System.Buffers.Binary;
using System.Text.RegularExpressions;

namespace Backend.Services;

public record ProductImageFile(string Url, string Name);

public class ProductImageStore(IWebHostEnvironment environment)
{
    public const long MaxFileBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".webp" };
    private string ImagesRoot => Path.Combine(environment.WebRootPath, "images");

    public IReadOnlyList<ProductImageFile> List()
    {
        var files = new List<ProductImageFile>();
        foreach (var folder in new[] { ImagesRoot, Path.Combine(ImagesRoot, "san-pham") })
        {
            if (!Directory.Exists(folder)) continue;
            foreach (var path in Directory.EnumerateFiles(folder).Where(p => Extensions.Contains(Path.GetExtension(p))))
            {
                var relative = Path.GetRelativePath(ImagesRoot, path).Replace('\\', '/');
                files.Add(new ProductImageFile("/images/" + string.Join('/', relative.Split('/').Select(Uri.EscapeDataString)), Path.GetFileName(path)));
            }
        }
        return files.OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<ProductImageFile> SaveAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0) throw new ArgumentException("Vui lòng chọn một ảnh.");
        if (file.Length > MaxFileBytes) throw new ArgumentException("Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.");
        var original = Path.GetFileName(file.FileName.Replace('\\', '/'));
        var extension = Path.GetExtension(original).ToLowerInvariant();
        if (!Extensions.Contains(extension)) throw new ArgumentException("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.");

        // Bound the read even if a caller supplies an incorrect Length. Never use a client path for storage.
        await using var input = file.OpenReadStream();
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int count;
        while ((count = await input.ReadAsync(chunk, cancellationToken)) != 0)
        {
            if (buffer.Length + count > MaxFileBytes) throw new ArgumentException("Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB.");
            await buffer.WriteAsync(chunk.AsMemory(0, count), cancellationToken);
        }
        var bytes = buffer.ToArray();
        if (!MatchesFormat(bytes, extension)) throw new ArgumentException("Nội dung ảnh không hợp lệ hoặc không khớp đuôi file. Hãy chọn ảnh khác.");

        var stem = Regex.Replace(Path.GetFileNameWithoutExtension(original), "[^a-zA-Z0-9-]+", "-").Trim('-');
        if (stem.Length == 0) stem = "san-pham";
        if (stem.Length > 48) stem = stem[..48];
        var name = $"{stem}-{Guid.NewGuid():N}{extension}";
        var folder = Path.Combine(ImagesRoot, "san-pham");
        Directory.CreateDirectory(folder);
        var target = Path.Combine(folder, name);
        // An incomplete file never appears in the image list or at its final URL.
        var temporary = target + ".tmp";
        try
        {
            await File.WriteAllBytesAsync(temporary, bytes, cancellationToken);
            File.Move(temporary, target, overwrite: false);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
        return new ProductImageFile("/images/san-pham/" + name, name);
    }

    private static bool MatchesFormat(ReadOnlySpan<byte> bytes, string extension)
    {
        if (extension is ".jpg" or ".jpeg")
            return bytes.Length >= 12 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff
                && bytes[^2] == 0xff && bytes[^1] == 0xd9;
        if (extension == ".png")
            return bytes.Length >= 45 && bytes[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
                && bytes.Slice(12, 4).SequenceEqual("IHDR"u8)
                && BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(16, 4)) > 0
                && BinaryPrimitives.ReadUInt32BigEndian(bytes.Slice(20, 4)) > 0
                && bytes.Slice(bytes.Length - 8, 4).SequenceEqual("IEND"u8);
        return bytes.Length >= 20 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8)
            && BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(4, 4)) == bytes.Length - 8
            && (bytes.Slice(12, 4).SequenceEqual("VP8 "u8) || bytes.Slice(12, 4).SequenceEqual("VP8L"u8) || bytes.Slice(12, 4).SequenceEqual("VP8X"u8));
    }
}
