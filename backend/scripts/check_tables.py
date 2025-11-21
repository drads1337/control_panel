#!/usr/bin/env python3
import os
import sys
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)
os.chdir(backend_dir)

from flask import Flask
from backend.config.config import Config
from backend.core.extensions import db
from sqlalchemy import inspect

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    print(f'Найдено таблиц: {len(tables)}')
    if tables:
        print('\nСписок таблиц:')
        for table in sorted(tables):
            print(f'  - {table}')
    else:
        print('База данных пуста')

