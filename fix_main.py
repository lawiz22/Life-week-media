import re

with open('electron/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the problematic section
old_pattern = r'''let pathName = request\.url;
      if \(pathName\.startsWith\('media://file/'\)\) \{
        pathName = pathName\.replace\('media://file/', ''\);
      \} else \{
        pathName = pathName\.replace\(/\^media:\\/\\//, ''\);
      \}
      
      pathName = decodeURIComponent\(pathName\);'''

new_code = '''let pathName = request.url;
      if (pathName.startsWith('media://file/')) {
        const base64Path = pathName.replace('media://file/', '');
        pathName = Buffer.from(base64Path, 'base64').toString('utf-8');
      } else {
        pathName = pathName.replace(/^media:\\/\\//, '');
        pathName = decodeURIComponent(pathName);
      }'''

content = re.sub(old_pattern, new_code, content, flags=re.MULTILINE)

with open('electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully")
