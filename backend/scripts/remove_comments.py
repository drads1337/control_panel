
import tokenize
import io
from pathlib import Path

def remove_comments(source_code):
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source_code).readline))
        lines = source_code.split('\n')
        lines_to_remove_comment = {}
        
        for token in tokens:
            if token.type == tokenize.COMMENT:
                line_num = token.start[0] - 1
                col = token.start[1]
                if line_num not in lines_to_remove_comment:
                    lines_to_remove_comment[line_num] = col
        
        result_lines = []
        for i, line in enumerate(lines):
            if i in lines_to_remove_comment:
                comment_start = lines_to_remove_comment[i]
                cleaned_line = line[:comment_start].rstrip()
                result_lines.append(cleaned_line)
            else:
                result_lines.append(line)
        
        return '\n'.join(result_lines)
    except:
        lines = source_code.split('\n')
        cleaned_lines = []
        
        for line in lines:
            in_string = False
            string_char = None
            comment_pos = -1
            i = 0
            
            while i < len(line):
                char = line[i]
                
                if char == '\\' and i + 1 < len(line):
                    i += 2
                    continue
                
                if char in ['"', "'"]:
                    if i + 2 < len(line) and line[i:i+3] == char * 3:
                        if not in_string:
                            in_string = True
                            string_char = char * 3
                            i += 3
                            continue
                        elif string_char == char * 3:
                            in_string = False
                            string_char = None
                            i += 3
                            continue
                    
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif char == string_char:
                        in_string = False
                        string_char = None
                elif char == '#' and not in_string:
                    comment_pos = i
                    break
                
                i += 1
            
            if comment_pos >= 0:
                cleaned_line = line[:comment_pos].rstrip()
                if cleaned_line:
                    cleaned_lines.append(cleaned_line)
            else:
                cleaned_lines.append(line)
        
        return '\n'.join(cleaned_lines)

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        cleaned_content = remove_comments(content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(cleaned_content)
        
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    backend_dir = Path(__file__).parent.parent
    
    python_files = list(backend_dir.rglob('*.py'))
    
    excluded_dirs = {'__pycache__', 'venv', 'migrations', 'tests'}
    python_files = [
        f for f in python_files 
        if not any(excluded in f.parts for excluded in excluded_dirs)
    ]
    
    print(f"Found {len(python_files)} Python files to process")
    
    processed = 0
    failed = 0
    
    for file_path in python_files:
        print(f"Processing: {file_path.relative_to(backend_dir.parent)}")
        if process_file(file_path):
            processed += 1
        else:
            failed += 1
    
    print(f"\nCompleted: {processed} files processed, {failed} files failed")

if __name__ == "__main__":
    main()
