import sqlite3, re, sys, os

# Resolve the database relative to this file so the script works from any cwd.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db = os.path.join(ROOT, 'data', 'foodsave.db')
c = sqlite3.connect(db)
c.row_factory = sqlite3.Row

tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print('tables:', tables)

target = None
for t in tables:
    cols = [r[1] for r in c.execute(f'PRAGMA table_info({t})')]
    if 'food_name' in cols:
        target = t
        print('food table:', t, 'columns:', cols)
        break

if not target:
    sys.exit('no food table found')

total = c.execute(f'SELECT COUNT(*) FROM {target}').fetchone()[0]
print('total listings:', total)

patterns = ['Harness %', 'Automated QA %', 'Smoke Test %', 'Harness%']
matched = []
for row in c.execute(f'SELECT * FROM {target}'):
    name = row['food_name'] or ''
    if any(re.match(p.replace('%', '.*'), name, re.I) for p in patterns):
        matched.append((row['id'], name, row['donor_name']))

print('\nharness-created rows:', len(matched))
for m in matched:
    print('  ', m)

if matched:
    ids = [m[0] for m in matched]
    q = ','.join(str(i) for i in ids)
    # remove dependent rows first
    for child in ['claim_chats', 'chat_messages', 'messages', 'pickup_passes', 'claims']:
        if child in tables:
            try:
                c.execute(f'DELETE FROM {child} WHERE food_id IN ({q})')
                print('  cleaned', child)
            except Exception as e:
                print('  skip', child, e)
    c.execute(f'DELETE FROM {target} WHERE id IN ({q})')
    c.commit()
    left = c.execute(f'SELECT COUNT(*) FROM {target}').fetchone()[0]
    print('\nlistings left:', left)

# harness chat messages and support tickets
if 'claim_chats' in tables:
    cols = [r[1] for r in c.execute('PRAGMA table_info(claim_chats)')]
    msgcol = 'message' if 'message' in cols else None
    if msgcol:
        n = c.execute("SELECT COUNT(*) FROM claim_chats WHERE message LIKE 'Harness message%'").fetchone()[0]
        c.execute("DELETE FROM claim_chats WHERE message LIKE 'Harness message%'")
        print(f'\nremoved {n} harness chat messages')

if 'support_tickets' in tables:
    cols = [r[1] for r in c.execute('PRAGMA table_info(support_tickets)')]
    mcol = 'message' if 'message' in cols else None
    if mcol:
        n = c.execute("SELECT COUNT(*) FROM support_tickets WHERE message LIKE 'Harness support message%'").fetchone()[0]
        c.execute("DELETE FROM support_tickets WHERE message LIKE 'Harness support message%'")
        print(f'removed {n} harness support tickets')

c.commit()
print('\nfinal counts:')
for t in tables:
    if t == 'sqlite_sequence':
        continue
    try:
        print(f'  {t}: {c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]}')
    except Exception:
        pass
