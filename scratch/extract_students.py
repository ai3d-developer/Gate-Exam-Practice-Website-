import pypdf
import json
import re

def parse_3rd_year(path):
    reader = pypdf.PdfReader(path)
    students = []
    for page in reader.pages:
        text = page.extract_text()
        for line in text.split('\n'):
            line = line.strip()
            # Match S.NO REG NO. NAME OF THE STUDENT
            # Example: "1 420724105001 AAKASH S"
            match = re.match(r'^(\d+)\s+(\d{12})\s+(.+)$', line)
            if match:
                sno = match.group(1)
                reg_no = match.group(2)
                name = match.group(3).strip()
                students.append({
                    "regNo": reg_no,
                    "name": name,
                    "year": "3rd Year"
                })
    return students

def parse_4th_year(path):
    reader = pypdf.PdfReader(path)
    students = []
    for page in reader.pages:
        text = page.extract_text()
        for line in text.split('\n'):
            line = line.strip()
            # Example: "420723105001,AGALYA.N"
            match = re.match(r'^(\d{12}),(.+)$', line)
            if match:
                reg_no = match.group(1)
                name = match.group(2).strip()
                students.append({
                    "regNo": reg_no,
                    "name": name,
                    "year": "4th Year" # user refers to final year as 4th Year or final year
                })
    return students

students_3rd = parse_3rd_year("d:\\gate test site\\3rd year.pdf")
students_4th = parse_4th_year("d:\\gate test site\\4th year.pdf")

print(f"Parsed {len(students_3rd)} students from 3rd year")
print(f"Parsed {len(students_4th)} students from 4th year")

# Write to a JSON file
with open("d:\\gate test site\\src\\components\\students.json", "w") as f:
    json.dump({
        "3rd Year": students_3rd,
        "4th Year": students_4th
    }, f, indent=2)

print("Saved to src/components/students.json")
