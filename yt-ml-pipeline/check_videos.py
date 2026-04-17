import glob, os

videos = glob.glob('dataset/*.mp4')
sizes = [(v, os.path.getsize(v)/(1024*1024)) for v in videos[:20]]

print(f'Total videos: {len(videos)}')
print(f'\nFirst 20:')
for v, s in sizes:
    print(f'  {os.path.basename(v):30} {s:8.1f} MB')

all_sizes = [os.path.getsize(v)/(1024*1024) for v in videos]
print(f'\nMin: {min(all_sizes):.1f} MB')
print(f'Max: {max(all_sizes):.1f} MB')
print(f'Avg: {sum(all_sizes)/len(all_sizes):.1f} MB')
print(f'Under 50MB: {sum(1 for s in all_sizes if s < 50)}')
print(f'50-100MB: {sum(1 for s in all_sizes if 50 <= s < 100)}')
print(f'Over 100MB: {sum(1 for s in all_sizes if s >= 100)}')
