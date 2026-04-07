import json
import os
import threading

from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datebase import db, setGiftCode, getGiftCodesByPage, update_user_cdk_statistics, batch_check_users_have_cdks, getUserID, setUserID
from models import User, redeemCode, danmu, Admin
from auth import api_sign_required
import time
from sqlalchemy import or_, and_, cast, Integer
from app import _run, _runAll, _runUserAll, login_fid, xhsApi
from sendEmail import send_html_email
from apscheduler.schedulers.background import BackgroundScheduler
from pytz import timezone
from dotenv import load_dotenv

load_dotenv()

def CodeAdd(codes):
    # 添加兑换码
    with app.app_context():
        try:
            for code in codes:
                cdk = code.get('code')
                if not cdk: continue
                req = redeemCode.query.filter_by(code=cdk).first()
                endTime = ""
                t = code.get('type', 0)
                if code.get('endTime'):
                    endTime = xhsApi.string_to_timestamp(code.get('endTime'))
                    t = 1
                if req:
                    if req.endTime == endTime:
                        continue
                    # 情况2：cdk存在时间戳不相等
                    else:
                        req.endTime = endTime
                        req.type = t
                else:
                    new_code = redeemCode(
                        code=cdk,
                        type=t,
                        endTime=endTime
                    )
                    db.session.add(new_code)
            db.session.commit()
        except Exception as e:
            db.session.rollback()



def UserAdd(fid, email):
    # 添加用户
    with app.app_context():
        if User.query.filter_by(fid=fid).first():
            return jsonify({'msg': '已经添加过了'})
        new_user = User(fid=fid, email=email)
        try:
            db.session.add(new_user)
            db.session.commit()
            return jsonify({'msg': '添加成功', 'code': 0})
        except Exception as e:
            db.session.rollback()
            return jsonify({'msg': '添加失败', 'code': 401})


def DanmuAdd(fid, amount):
    with app.app_context():
        if danmu.query.filter_by(fid=fid).first():
            return jsonify({'msg': '已经添加过了'})
        res = login_fid(fid)
        if isinstance(res, str):
            return jsonify({'msg': '添加失败', 'code': 401})
        new_danmu = danmu(fid=fid, amount=str(amount), avatar=res.get('avatar_image'), username=res.get('nickname'))
        try:
            db.session.add(new_danmu)
            db.session.commit()
            return jsonify({'msg': '添加成功', 'code': 0})
        except Exception as e:
            db.session.rollback()
            return jsonify({'msg': '添加失败', 'code': 401})


def AutoAddCode():
    # 自动从小红书获取兑换码添加
    xhs = xhsApi()
    xhs.init()
    codeList = xhs.PostInfo(5)
    if not codeList:
        return
    isCode = False  # 是否有新的兑换码入库
    with app.app_context():
        try:
            for code in codeList:
                endTime = ''
                cdk = code[0]
                t = 0
                if len(code) >= 2:
                    endTime = code[1]
                if endTime:
                    t = 1 # 0是长期兑换码1是限时兑换码
                req = redeemCode.query.filter_by(code=cdk).first()
                if req:
                    # 情况1：cdk存在且时间戳相等
                    if req.endTime == endTime:
                        continue
                    # 情况2：cdk存在时间戳不相等
                    else:
                        req.endTime = endTime
                        req.type = t
                # cdk不存在的情况
                else:
                    new_code = redeemCode(
                        code=cdk,
                        type=t,
                        endTime=endTime
                    )
                    db.session.add(new_code)
                isCode = True
            db.session.commit()
            if isCode:
                UserCodeAll()
        except Exception:
            db.session.rollback()



def UserCodeAll():
    # 为所有用户自动兑换
    with app.app_context():
        current_timestamp = round(time.time())

        active_codes = redeemCode.query.filter(
            and_(redeemCode.type == 1, cast(redeemCode.endTime, Integer) > current_timestamp)
        ).all()
        if not active_codes:
            return
        users = User.query.filter(
            or_(
                # cast(User.endTime, Integer) > current_timestamp
                User.status == 0
            )
        ).all()
        if not users:
            return

        user_data = []
        email_data = []
        emailDict = {}
        for user in users:
            user_data.append(str(user.fid))
            email_data.append(user.email)
        code_data = []
        for code in active_codes:
            code_data.append(code.code)
        cdkInfo = batch_check_users_have_cdks(user_data, code_data)
        userCodeList = cdkInfo['users_without_cdks'] # 取所有未使用的用户和兑换码详情
        if not userCodeList:
            return
        result, deleteUser = _runUserAll(userCodeList)
        # print("大熔炉低于9的用户", deleteUser)
        for u in deleteUser:
            user = User.query.filter_by(fid=int(u)).first()
            db.session.delete(user)
            db.session.commit()

        successList = []
        resList = []
        for n in result:
            data = n['userInfo']
            fid = str(data['fid'])
            index = user_data.index(fid)
            email = email_data[index]
            cdk_success = data.get('cdk')
            cdk_res = data.get('cdk_res')
            if cdk_success:
                if cdk_res:
                    del data['cdk_res']
                data['auto'] = True
                data['repeat'] = False
                successList.append(data)
                active_codes = redeemCode.query.filter(redeemCode.code.in_(cdk_success.split(','))).all()
                for code in active_codes:
                    code.success += 1
                    code.total = code.success + code.failed
            elif cdk_res:
                del data['cdk_res']
                data['auto'] = True
                data['cdk'] = cdk_res
                data['repeat'] = True
                resList.append(data)
            if not cdk_success or not email:
                continue
            db.session.commit()
            if not emailDict.get(email):
                emailDict[email] = []
            emailDict[email].append({'fid': fid, 'nickname': data['nickname'], 'cdk': cdk_success})
        if emailDict:
            for email, valList in emailDict.items():
                nickname = ''
                fid = ''
                cdk = ''
                for val in valList:
                    cdk += val.get('cdk') + ','
                    nickname += val.get('nickname') + ','
                    fid += val.get('fid') + ','
                cdk = cdk[:-1]
                cdkList = cdk.split(',')
                if len(cdkList) == 1:
                    cdk = cdkList[0]
                else:
                    cdk = ','.join(set(cdkList))
                send_html_email(email, nickname[:-1], fid[:-1], cdk)
        if successList:
            setGiftCode(successList)
        if resList:
            setGiftCode(resList)
        update_user_cdk_statistics()

beijing_tz = timezone('Asia/Shanghai')
# 任务调度器
scheduler = BackgroundScheduler(daemon=True, timezone=beijing_tz)
scheduler.add_job(
    AutoAddCode,
    'cron',
    hour='12,20',
    minute='0',
    second='0',
    name='AutoAddCode',
    id='1'
)

scheduler.add_job(
    UserCodeAll,
    'cron',
    hour='0,2,4,6,8,10,12,14,16,18,20,22',
    minute='0',
    name='userCodeAll',
    id='2'
)
scheduler.start()
app = Flask(__name__)

# ========================
# 应用配置
# ========================
DATABASE_URL = os.getenv('MYSQL_URL')
app.config.update(
    # 数据库配置
    SQLALCHEMY_DATABASE_URI=DATABASE_URL,
    SQLALCHEMY_ENGINE_OPTIONS={
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {
            'charset': 'utf8mb4',
            'collation': 'utf8mb4_unicode_ci'
        }
    },
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    # 安全配置
    PROPAGATE_EXCEPTIONS=True
)

db.init_app(app)

CORS(app,
     supports_credentials=True,
     allow_headers=["Authorization", "Content-Type", "TypeFile"],
     expose_headers=["Authorization"])

@app.route('/')
def dashboard():
    return render_template('index.html')


@app.route('/api/addUser', methods=['POST'])
@api_sign_required
def addUser():
    # 添加账号
    if request.method == 'GET':
        return jsonify(msg='请求错误'), 400
    data = request.get_json()
    fid = data.get('fid')
    email = data.get('email')
    if not fid or not email:
        return jsonify(msg='缺少关键参数')
    if User.query.filter_by(fid=int(fid)).first():
        return jsonify({'msg': '已经添加过了'})
    endTime = '2026-12-01 23:59:00'  # 这里可以设置用户过期时间，默认不启用
    new_user = User(fid=fid, email=email, endTime=xhsApi.string_to_timestamp(endTime), status=0)
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'msg': '添加成功', 'code': 0})
    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': '添加失败', 'code': 401})



@app.route('/api/delUser', methods=['POST'])
@api_sign_required
def delUser():
    # 删除账号
    if request.method == 'GET':
        return jsonify(msg='请求错误')
    data = request.get_json()
    fid = data.get('fid')
    email = data.get('email')
    if not fid or not email:
        return jsonify(msg='缺少关键参数')
    user = User.query.filter_by(fid=int(fid)).first()
    if not user:
        return jsonify(msg='账号不存在')
    try:
        if user.status != 0:
            return jsonify({'msg': '删除失败，你的账号已被禁用', 'code': 401})
        if user.email == email:
            db.session.delete(user)
            db.session.commit()
            return jsonify({'msg': '删除成功', 'code': 0})
        else:
            return jsonify({'msg': '删除失败，邮箱和注册时不匹配\n如忘记注册邮箱可联系作者核实后删除', 'code': 401})
    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': '删除失败', 'code': 401})

@app.route('/api/addGiftCode', methods=['POST'])
@api_sign_required
def addGiftCode():
    """添加兑换码"""
    if request.method == 'GET':
        return jsonify(msg='请求错误', code=401)
    data = request.get_json()
    cdk = data.get('cdk')
    pwd = data.get('pwd')
    t = data.get('type', 0)
    endTime = data.get('endTime', '')
    if not cdk or not pwd:
        return jsonify(msg='缺少关键参数', code=401)
    admin = Admin.query.filter_by(password=pwd).first()
    if not admin:
        return jsonify({'msg': '你没有权限\n添加微信：838210720申请成为管理员', 'code': 401})
    if admin.status != 0:
        return jsonify({'msg': f'{admin.username}，你已被封禁', 'code': 401})

    req = redeemCode.query.filter_by(code=cdk).first()
    if endTime:
        endTime = xhsApi.string_to_timestamp(endTime + ' 23:59:00')
    if req:
        # 情况1：cdk存在且时间戳相等
        if req.endTime == endTime:
            return jsonify({'msg': '兑换码已存在', 'code': 401})
        # 情况2：cdk存在时间戳不相等
        else:
            # print(req)
            # print(req.endTime)
            # print(endTime)
            # print(xhsApi.string_to_timestamp(endTime + ' 23:59:00'))
            # print(req.endTime == xhsApi.string_to_timestamp(endTime + ' 23:59:00'))
            req.endTime = endTime
            req.type = int(t)
            msg = '兑换码更新成功'
    # cdk不存在的情况
    else:
        newCode = redeemCode(
            code=cdk,
            type=int(t),
            endTime=endTime
        )
        db.session.add(newCode)
        msg = '兑换码添加成功'
    try:
        db.session.commit()
        return jsonify(msg=msg, code=0)
    except Exception as e:
        db.session.rollback()
        return jsonify(msg="兑换码添加失败", code=401)


@app.route('/api/getGiftCode', methods=['GET'])
@api_sign_required
def getGiftCode():
    # 获取兑换码列表
    current_timestamp = round(time.time())
    active_codes = redeemCode.query.filter(
        or_(
            and_(redeemCode.type == 1, cast(redeemCode.endTime, Integer) > current_timestamp),
            redeemCode.type == 0
        )
    ).all()
    result_data = []
    for code in active_codes:
        result_data.append({
            'code': code.code,
            'total': code.total,
            'success': code.success,
            'failed': code.failed,
            'type': code.type,
            'endTime': code.endTime,
            'created_at': code.created_at
        })
    sorted_data = sorted(result_data, key=lambda x: int(x['created_at']), reverse=True)
    return jsonify({
        'code': 0,
        'message': 'ok',
        'data': sorted_data,
        'count': len(result_data)
    })


@app.route('/api/giftCode', methods=['POST'])
@api_sign_required
def _Code():
    # 使用兑换码
    data = request.get_json()
    fid = data.get('fid')
    cdk = data.get('cdk')
    if not fid or not cdk:
        return jsonify(msg='缺少关键参数')
    result = _run(fid, cdk)
    if isinstance(result, str):
        if '大熔炉等级低于9' in result:
            user = User.query.filter_by(fid=int(fid)).first()
            db.session.delete(user)
            db.session.commit()
        return jsonify({'msg': result})
    active_codes = redeemCode.query.filter_by(code=cdk).first()
    if result['msg'] == '兑换成功':
        userInfo = result['userInfo']
        setGiftCode([userInfo])
        active_codes.success += 1
    else:
        active_codes.failed += 1
    active_codes.total = active_codes.success + active_codes.failed
    db.session.commit()
    del result['userInfo']
    update_user_cdk_statistics()
    return jsonify(result)


def _async_runAll(fid, code_data):
    result = _runAll(fid, code_data)
    if isinstance(result, str):
        if any(key in result for key in ('大熔炉等级低于9', '用户角色不存在')):
            user = User.query.filter_by(fid=int(fid)).first()
            db.session.delete(user)
            db.session.commit()
        return
    userInfo = result['userInfo']
    cdk_success = userInfo.get('cdk')
    cdk_res = userInfo.get('cdk_res')
    userInfo['repeat'] = False
    if cdk_success:
        if cdk_res:
            del userInfo['cdk_res']
        active_codes = redeemCode.query.filter(redeemCode.code.in_(list(cdk_success))).all()
        for code in active_codes:
            code.success += 1
            code.total = code.success + code.failed
        db.session.commit()
    elif cdk_res:
        del userInfo['cdk_res']
        userInfo['repeat'] = True
        userInfo['cdk'] = cdk_res
    setGiftCode([userInfo])
    update_user_cdk_statistics()


@app.route('/api/giftCodeAll', methods=['POST'])
@api_sign_required
def _CodeAll():
    data = request.get_json()
    fid = data.get('fid')
    t = data.get('type', '0')
    if not fid:
        return jsonify(msg='缺少关键参数')
    isExist, ttl = getUserID(fid)
    if isExist:
        return jsonify(msg=f'兑换太频繁，请等待{ttl}秒后再兑换吧')

    code_data = []
    current_timestamp = round(time.time())
    if t == '0':
        active_codes = redeemCode.query.filter(
            and_(redeemCode.type == 1, cast(redeemCode.endTime, Integer) > current_timestamp)
        ).all()
    else:
        active_codes = redeemCode.query.filter_by(type=0).all()
    if not active_codes:
        return {"msg": "兑换失败，当前无可用兑换码"}
    for code in active_codes:
        code_data.append(code.code)
    cdkInfo = batch_check_users_have_cdks([fid], code_data)
    code_data = cdkInfo['users_without_cdks'].get(fid, None)
    if not code_data:
        return {'msg': '兑换失败，当前无可用兑换码'}
    setUserID(fid)
    threading.Thread(target=_async_runAll, args=(fid, code_data), daemon=True).start()
    return {'msg': '已添加兑换任务，可在1~2分钟后刷新近期兑换列表查看兑换结果'}



@app.route('/api/r/getGiftCode', methods=['GET'])
@api_sign_required
def _getGiftCodes():
    # 获取缓存中兑换成功的兑换码信息
    page = request.args.get('page', 1, type=int)
    size = request.args.get('size', 20, type=int)
    res = getGiftCodesByPage(page, size)
    return json.dumps(res, separators=(',', ':'))


@app.route('/api/getDanmu', methods=['GET'])
@api_sign_required
def getDanmu():
    # 获取所有弹幕数据
    danmu_list = danmu.query.all()

    current_time = int(time.time() * 1000)
    update_threshold = 24 * 60 * 60 * 1000

    # 用于存储需要更新的fid及其对应的记录
    need_update_info = {}  # fid -> {'records': [], 'old_timestamp': timestamp}
    result_data = []

    # 第一次遍历：准备结果数据和识别需要更新的记录
    for d in danmu_list:
        # 检查是否需要更新
        if d.fid and (current_time - int(d.created_at) >= update_threshold):
            if d.fid not in need_update_info:
                need_update_info[d.fid] = {'records': []}
            need_update_info[d.fid]['records'].append(d)

        # 先添加当前数据到结果中
        result_data.append({
            'fid': d.fid,
            'username': d.username,
            'amount': d.amount,
            'avatar': d.avatar
        })

    # 批量处理需要更新的fid
    if need_update_info:
        # 批量查询用户信息
        for fid in list(need_update_info.keys()):
            info = login_fid(fid)
            if isinstance(info, dict):
                need_update_info[fid]['user_info'] = {
                    'nickname': info['nickname'],
                    'avatar': info['avatar_image']
                }

        # 更新数据库记录并同时更新返回结果
        for fid, update_data in need_update_info.items():
            if 'user_info' in update_data:
                user_info = update_data['user_info']
                # 更新所有相关记录
                for record in update_data['records']:
                    # 更新数据库记录
                    record.username = user_info['nickname']
                    record.avatar = user_info['avatar']
                    record.created_at = str(current_time)

                    # 更新返回结果中对应的数据
                    for i, item in enumerate(result_data):
                        if item['fid'] == fid and item['amount'] == record.amount:
                            result_data[i]['username'] = user_info['nickname']
                            result_data[i]['avatar'] = user_info['avatar']
                            break

    # 提交更改
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # 重新构建结果数据（使用原始数据）
        result_data = [{
            'fid': d.fid,
            'username': d.username,
            'amount': d.amount,
            'avatar': d.avatar
        } for d in danmu_list]

    return jsonify({
        'code': 0,
        'message': 'ok',
        'data': result_data,
        'count': len(result_data)
    })


if __name__ == '__main__':
    # DanmuAdd(428274657, 3)
    # print(UserAdd(428274657, "690518713@qq.com"))
    # data = [{"code": "XUEHUA", "endTime": "2026-01-18 23:59:00", 'type': 1}]
    # CodeAdd(data)
    app.run(host='0.0.0.0', port=5201)
    # UserCodeAll()
    # AutoAddCode()