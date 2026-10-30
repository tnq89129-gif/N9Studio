using System.Text;
using System.Text.RegularExpressions;
namespace Backend.Services;
public static class CategoryRules {
    public static string Name(string value) => Regex.Replace(value.Normalize(NormalizationForm.FormC).Trim(), @"\s+", " ");
    public static string Code(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), @"\s+", " ");
    public static bool ValidCode(string value) => value.Length is >0 and <=60 && Regex.IsMatch(value,@"^[a-z0-9]+(?:[ -][a-z0-9]+)*$");
    public static string Slug(string value) {
        var clean=new string(value.Normalize(NormalizationForm.FormD).Where(c=>System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)!=System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
        var code=Regex.Replace(clean.Replace('đ','d').Replace('Đ','D').ToLowerInvariant(),@"[^a-z0-9]+","-").Trim('-');
        if(code.Length==0)code="danh-muc-"+Guid.NewGuid().ToString("N")[..8];
        return code[..Math.Min(code.Length,60)].TrimEnd('-');
    }
}
