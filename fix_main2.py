with open('electron/main.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line 107 and replace lines 107-114
new_lines = []
i = 0
while i < len(lines):
    if i == 106 and 'let pathName = request.url;' in lines[i]:  # Line 107 (0-indexed = 106)
        # Replace lines 107-114 (indices 106-113)
        new_lines.append('      let pathName = request.url;\r\n')
        new_lines.append('      if (pathName.startsWith(\'media://file/\')) {\r\n')
        new_lines.append('        const base64Path = pathName.replace(\'media://file/\', \'\');\r\n')
        new_lines.append('        pathName = Buffer.from(base64Path, \'base64\').toString(\'utf-8\');\r\n')
        new_lines.append('      } else {\r\n')
        new_lines.append('        pathName = pathName.replace(/^media:\\/\\//, \'\');\r\n')
        new_lines.append('        pathName = decodeURIComponent(pathName);\r\n')
        new_lines.append('      }\r\n')
        i += 8  # Skip the next 7 lines (108-114, indices 107-113)
    else:
        new_lines.append(lines[i])
        i += 1

with open('electron/main.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Updated {len(new_lines)} lines")
