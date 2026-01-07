#!/usr/bin/env python3
"""
Скрипт для создания CA сертификата для проекта
Использование: python scripts/create_project_ca.py <project_id> [project_name]
"""

import sys
from pathlib import Path

# Добавляем путь к backend
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from backend.core.app import create_app
from backend.utils.mtls_manager import MTLSProjectManager
from backend.models.project import Project

def main():
    if len(sys.argv) < 2:
        print("Использование: python create_project_ca.py <project_id> [project_name]")
        sys.exit(1)
    
    project_id = sys.argv[1]
    project_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    app = create_app()
    with app.app_context():
        # Пытаемся найти проект в базе
        project = Project.query.filter_by(unique_id=project_id).first()
        
        if project:
            print(f"Найден проект: {project.name} (ID: {project.unique_id})")
            project_name = project.name
        else:
            print(f"⚠️  Проект с ID {project_id} не найден в базе")
            if not project_name:
                project_name = f"Project-{project_id}"
            print(f"Создание CA с именем: {project_name}")
        
        try:
            manager = MTLSProjectManager()
            ca_cert, fingerprint = manager.ensure_project_ca(project_id, project_name)
            print(f"✅ CA успешно создан/проверен для проекта {project_id}")
            print(f"   Fingerprint: {fingerprint}")
            print(f"   Путь: {manager._project_dir(project_id) / 'ca' / 'ca-cert.pem'}")
        except Exception as e:
            print(f"❌ Ошибка при создании CA: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == "__main__":
    main()

