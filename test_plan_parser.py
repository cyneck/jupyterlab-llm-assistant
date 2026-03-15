"""Isolated test for _parse_plan_json (no tornado/jupyter_server deps)."""
import re, json

def _parse_plan_json(raw):
    raw = raw.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\s*```$', '', raw)
    start = raw.find('[')
    end   = raw.rfind(']')
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end+1]
    try:
        steps = json.loads(raw)
        if not isinstance(steps, list):
            raise ValueError('not a list')
        result = []
        for i, s in enumerate(steps):
            result.append({
                'id': s.get('id', i+1),
                'title': str(s.get('title', f'Step {i+1}')),
                'description': str(s.get('description', '')),
                'status': 'pending',
            })
        return result
    except Exception:
        return [{'id':1,'title':'Execute task','description':raw,'status':'pending'}]

TESTS = [
    ('[{"id":1,"title":"T1","description":"D1"}]', 1, 'bare JSON'),
    ('```json\n[{"id":1,"title":"T1","description":"D1"}]\n```', 1, 'json fence'),
    ('Sure!\n[{"id":1,"title":"A","description":"B"},{"id":2,"title":"C","description":"D"}]', 2, 'prose prefix'),
    ('not json at all', 1, 'invalid fallback'),
    ('[]', 0, 'empty array'),
    ('[{"id":1,"title":"Only title"}]', 1, 'missing description'),
]

all_pass = True
for raw, exp, label in TESTS:
    r = _parse_plan_json(raw)
    ok = len(r) == exp
    all_pass = all_pass and ok
    print(f"  {'OK  ' if ok else 'FAIL'} [{label}]: got {len(r)}, expected {exp}")
    for s in r:
        for k in ('id','title','description','status'):
            assert k in s, f'Missing key {k} in {s}'
        assert s['status'] == 'pending', f"status should be 'pending', got {s['status']}"

print()
print('Result:', 'ALL PASS' if all_pass else 'SOME FAILURES')
