#!/usr/bin/env python3
import sys
from pathlib import Path

backend_path = Path('/app/backend')
sys.path.insert(0, str(backend_path))

from backend.core.app import create_app
from backend.utils.mtls_manager import MTLSProjectManager
from backend.models.project import Project

project_id = '2920317791'
app = create_app()
with app.app_context():
    project = Project.query.filter_by(unique_id=project_id).first()
    if project:
        print(f'Найден проект: {project.name} (ID: {project.unique_id})')
        project_name = project.name
    else:
        print(f'Проект с ID {project_id} не найден в базе')
        project_name = f'Project-{project_id}'
        print(f'Создание CA с именем: {project_name}')
    
    try:
        manager = MTLSProjectManager()
        ca_cert, fingerprint = manager.ensure_project_ca(project_id, project_name)
        print(f'CA успешно создан/проверен для проекта {project_id}')
        print(f'Fingerprint: {fingerprint}')
        ca_path = manager._project_dir(project_id) / 'ca' / 'ca-cert.pem'
        print(f'Путь: {ca_path}')
    except Exception as e:
        print(f'Ошибка при создании CA: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

