"""Local administrator only: attach explicitly identified, unowned legacy records.

Preview is the default. --apply requires both a username and explicit session IDs,
and creates a consistent backup before changing any ownership. No public endpoint.
"""
import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def claim(database, username, session_ids, apply=False):
    database=Path(database).resolve()
    if not database.is_file():
        raise ValueError('数据库不存在。请先启动新版网站。')
    with sqlite3.connect(database) as con:
        con.row_factory=sqlite3.Row
        user=con.execute('SELECT user_id,username,name FROM lab_users WHERE username=? COLLATE NOCASE',(username,)).fetchone()
        if not user: raise ValueError('目标账号不存在，请先在新版网站注册。')
        records=[]
        for sid in dict.fromkeys(session_ids):
            row=con.execute('SELECT s.session_id,s.student_id,s.experiment_id,o.owner_id FROM sessions s LEFT JOIN lab_session_owners o ON o.session_id=s.session_id WHERE s.session_id=?',(sid,)).fetchone()
            if not row: raise ValueError('指定实验记录不存在。')
            if row['owner_id'] is not None: raise ValueError('记录已有归属，不能用本工具覆盖。')
            records.append(dict(row))
        if not apply: return records, None
        backup=database.with_name(database.stem+'-before-claim-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.db')
        with sqlite3.connect(backup) as dst: con.backup(dst)
        con.execute('BEGIN IMMEDIATE')
        # Recheck under the write lock in case another local operation ran after preview.
        for row in records:
            if con.execute('SELECT 1 FROM lab_session_owners WHERE session_id=?',(row['session_id'],)).fetchone():
                raise ValueError('记录刚被关联，请重新检查。')
            con.execute('INSERT INTO lab_session_owners VALUES (?,?)',(row['session_id'],user['user_id']))
        con.commit()
        return records, backup


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--database',required=True)
    p.add_argument('--username',required=True)
    p.add_argument('--session',action='append',required=True)
    p.add_argument('--apply',action='store_true')
    args=p.parse_args()
    try: rows,backup=claim(args.database,args.username,args.session,args.apply)
    except (ValueError,sqlite3.Error) as exc: p.exit(1,f'操作未完成：{exc}\n')
    for row in rows: print(row['session_id'],row['student_id'],row['experiment_id'])
    print(f'{len(rows)} 条记录：'+('已明确关联。' if args.apply else '仅预览，未修改数据库。'))
    if backup: print('升级前关联备份：',backup)

if __name__=='__main__':main()
