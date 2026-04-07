from main import app
from datebase import db
from models import *

with app.app_context():
    pass
    # 创建指定表
    # Admin.__table__.create(db.engine)
    # 创建所有表
    # db.create_all()
    # 删除所有表
    # db.drop_all()
