import os

import redis
from flask_sqlalchemy import SQLAlchemy
import json
import time
from dotenv import load_dotenv

db = SQLAlchemy()

load_dotenv()
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

def get_red():
    # redis 主 写入数据
    return redis.ConnectionPool(host=REDIS_HOST,
                                port=REDIS_PORT,
                                password=REDIS_PASSWORD,
                                decode_responses=True,
                                db=1)


def setGiftCode(userInfos: list[dict]):
    """存入最新兑换的信息"""
    if not isinstance(userInfos, list):
        return
    redis_conn = redis.Redis(connection_pool=get_red())
    current_time = round(time.time())
    expire_time = 120 * 60 * 60  # 120小时 只保存5天最新的信息

    for userInfo in userInfos:
        # 使用时间戳作为score，可以按时间排序
        score = current_time
        user_data = json.dumps(userInfo, separators=(',', ':'))
        # 添加到有序集合
        redis_conn.zadd('wjdrcdklist', {user_data: score})

    # 设置过期时间（可选，或者使用定时清理）
    # 删除120小时前的数据
    redis_conn.zremrangebyscore('wjdrcdklist', 0, current_time - expire_time)


def getGiftCodesByPage(page=1, page_size=10):
    """分页获取兑换码信息 - Sorted Set版本"""
    redis_conn = redis.Redis(connection_pool=get_red())

    # 计算起始位置
    start = (page - 1) * page_size
    end = start + page_size - 1

    # 按时间倒序获取分页数据（最新的在前面）
    page_data = redis_conn.zrevrange('wjdrcdklist', start, end, withscores=True)

    result = []
    for user_data, score in page_data:
        user_info = json.loads(user_data)
        user_info['timestamp'] = str(score)
        result.append(user_info)
    # 获取总条数
    total_count = redis_conn.zcard('wjdrcdklist')
    total_pages = (total_count + page_size - 1) // page_size

    return {
        'data': result,
        'pages': {
            'page': page,
            'page_size': page_size,
            'total_count': total_count,
            'total_pages': total_pages,
            'has_next': page < total_pages
        }
    }


def update_user_cdk_statistics():
    """更新用户CDK统计表（合并新旧数据，如果没有统计表则创建）"""
    redis_conn = redis.Redis(connection_pool=get_red())

    # 1. 检查是否存在统计表，如果不存在则直接创建
    if not redis_conn.exists('user_cdk_statistics'):
        return save_user_cdk_statistics_to_redis()

    # 2. 获取现有的统计结果（旧数据）
    old_stats = {}
    all_old_data = redis_conn.hgetall('user_cdk_statistics')
    for fid, cdk_string in all_old_data.items():
        old_stats[int(fid)] = set(cdk_string.split(',')) if cdk_string else set()

    # 3. 获取新的统计结果（从wjdrcdklist）
    new_stats = get_user_cdk_statistics()
    # 4. 合并新旧数据
    merged_stats = old_stats.copy()  # 先复制旧数据

    for user_info in new_stats:
        fid = user_info['fid']
        new_cdks = set(user_info['cdk'].split(',')) if user_info['cdk'] else set()
        if fid in merged_stats:
            # 合并CDK集合（自动去重）
            if len(merged_stats[fid]) >= 5:
                merged_stats[fid] = new_cdks
            else:
                merged_stats[fid].update(new_cdks)
        else:
            # 新用户，直接添加
            merged_stats[fid] = new_cdks
    # 5. 将合并后的数据写回Redis
    for fid, cdk_set in merged_stats.items():
        if cdk_set:  # 只存储有CDK的用户
            sorted_cdks = sorted(cdk_set)
            cdk_string = ','.join(sorted_cdks)
            redis_conn.hset('user_cdk_statistics', str(fid), cdk_string)
        else:
            # 如果用户没有CDK了，从统计中移除
            redis_conn.hdel('user_cdk_statistics', str(fid))
    return len(merged_stats)


def get_user_cdk_statistics():
    """统计每个用户兑换的所有CDK（去重）- 内部使用"""
    redis_conn = redis.Redis(connection_pool=get_red())  # 使用主库读取
    # 获取所有数据
    all_data = redis_conn.zrange('wjdrcdklist', 0, -1, withscores=False)

    # 使用字典来按用户分组CDK，key为fid，value为CDK集合
    user_cdk_map = {}

    for user_data in all_data:
        user_info = json.loads(user_data)
        fid = user_info.get('fid')
        cdk = user_info.get('cdk', '')

        # 如果用户不存在于字典中，初始化空的CDK集合
        if fid not in user_cdk_map:
            user_cdk_map[fid] = set()

        # 如果有多个CDK用逗号分隔，需要拆分并添加到集合
        if cdk:
            cdk_list = [c.strip() for c in cdk.split(',')]
            user_cdk_map[fid].update(cdk_list)

    # 转换为最终结果格式
    result = []
    for fid, cdk_set in user_cdk_map.items():
        # 将CDK集合排序并连接成字符串
        sorted_cdks = sorted(cdk_set)
        cdk_string = ','.join(sorted_cdks)

        result.append({
            'fid': fid,
            'cdk': cdk_string
        })

    return result


def save_user_cdk_statistics_to_redis():
    """统计用户CDK并存入不过期的Redis键（只存fid和cdk）"""
    redis_conn = redis.Redis(connection_pool=get_red())
    # 获取统计结果
    user_cdk_stats = get_user_cdk_statistics()
    # 使用Hash结构存储，key为fid，value为CDK字符串
    for user_info in user_cdk_stats:
        fid = user_info['fid']
        cdk_string = user_info['cdk']
        # 直接存储CDK字符串，不需要JSON
        redis_conn.hset('user_cdk_statistics', fid, cdk_string)
    return len(user_cdk_stats)


def check_user_has_cdk(fid, cdk):
    """检查用户是否拥有指定的CDK"""
    redis_conn = redis.Redis(connection_pool=get_red())
    # 从Hash中直接获取CDK字符串
    cdk_string = redis_conn.hget('user_cdk_statistics', fid)
    # print(cdk_string)
    if not cdk_string:
        return False
    # 将CDK字符串拆分为列表
    cdk_list = [c.strip() for c in cdk_string.split(',')]
    # 检查目标CDK是否在列表中
    return cdk in cdk_list


def batch_check_users_have_cdks(fid_list, cdk_list):
    """批量检查多个用户是否拥有指定的CDK集合
    返回包含所有查询结果的字典
    """
    redis_conn = redis.Redis(connection_pool=get_red())

    # 批量获取所有用户的CDK信息
    user_cdks_map = {}
    if fid_list:
        # 使用hmget批量获取多个fid的CDK
        cdk_strings = redis_conn.hmget('user_cdk_statistics', fid_list)

        for fid, cdk_string in zip(fid_list, cdk_strings):
            if cdk_string:
                user_cdks_map[fid] = set(cdk_string.split(','))
            else:
                user_cdks_map[fid] = set()

    # 构建结果
    result = {
        'users_with_cdks': {},  # 用户拥有的CDK {fid: [拥有的CDK列表]}
        'users_without_cdks': {},  # 用户不存在的CDK {fid: [不存在的CDK列表]}
        'all_matched': [],  # 拥有所有指定CDK的用户列表
        'partial_matched': [],  # 拥有部分指定CDK的用户列表
        'none_matched': []  # 没有拥有任何指定CDK的用户列表
    }

    for fid in fid_list:
        user_cdks = user_cdks_map.get(fid, set())
        has_cdks = []
        missing_cdks = []

        for cdk in cdk_list:
            if cdk in user_cdks:
                has_cdks.append(cdk)
            else:
                missing_cdks.append(cdk)

        # 记录用户拥有的和不存在的CDK
        if has_cdks:
            result['users_with_cdks'][fid] = has_cdks
        if missing_cdks:
            result['users_without_cdks'][fid] = missing_cdks

        # 分类用户
        if len(has_cdks) == len(cdk_list):  # 拥有所有CDK
            result['all_matched'].append(fid)
        elif has_cdks:  # 拥有部分CDK
            result['partial_matched'].append(fid)
        else:  # 没有拥有任何CDK
            result['none_matched'].append(fid)

    return result


def clear_gift_codes():
    """清空整个KEY"""
    redis_conn = redis.Redis(connection_pool=get_red())
    result = redis_conn.delete('wjdrcdklist')
    if result == 1:
        return True
    else:
        return False


def setUserID(fid: str | int):
    """设置用户状态,避免频繁提交兑换请求"""
    redis_conn = redis.Redis(connection_pool=get_red())
    redis_conn.setex(str(fid), 120, 0)

def getUserID(fid: str | int) -> (bool, int):
    """检查用户状态"""
    redis_conn = redis.Redis(connection_pool=get_red())
    return True if redis_conn.exists(str(fid)) else False, redis_conn.ttl(fid)

# setUserID(428274657)
# print(getUserID(428274657))

# print(clear_gift_codes())
# setGiftCode([{
#             "fid": 23342,
#             "nickname": "\u80d6\u8fbe\u5386\u9669\u8bb0",
#             "kid": 2568,
#             "stove_lv": 50,
#             "stove_lv_content": "https:\/\/gofcn-prod-avatar-cdn.campfiregames.cn\/attachment\/img\/icon\/stove_lv_4.png",
#             "avatar_image": "https:\/\/gofcn-prod-avatar-cdn.campfiregames.cn\/avatar\/2025\/09\/15\/mpo9Xn_1757882445.png",
#             "cdk": "WJDR350W"
#         }])

#
# print(getGiftCodesByPage(1,10))
#
#
# print(check_gift_code_used(661455442, "LYJ666"))
# fid_list = [428274657]  # 用户列表
# cdk_list = ["LYJ666","LYJ777","LYJ888","WJDR2025","WJDR350W","WJDR899"]  # CDK列表
#
# result = batch_check_users_have_cdks(fid_list, cdk_list)['users_without_cdks']
# print(result)
# for key, value in result.items():
#     print(key, value)
# user_cdk_stats = get_user_cdk_statistics()
# print(user_cdk_stats)
# print(update_user_cdk_statistics())
# save_user_cdk_statistics_to_redis()
# print(check_user_has_cdk(428274657, 'LYJ666'))
# print(get_all_user_cdk_statistics())
# setGiftCode([{"fid":428274657,"nickname":"胖达历险记","kid":2568,"stove_lv":50,"stove_lv_content":"https://gofcn-prod-avatar-cdn.campfiregames.cn/attachment/img/icon/stove_lv_4.png","avatar_image":"https://gofcn-prod-avatar-cdn.campfiregames.cn/avatar/2025/09/15/mpo9Xn_1757882445.png","total_recharge_amount":0,"cdk":"WJDR350W,TILI520","timestamp":"1760497238.0"}])