import sys

with open("src/app/draft-room/page.tsx", "r") as f:
    orig_code = f.read()

start_sig = "  const processedPool = useMemo(() => {"
end_sig = "  }, [displayPool, searchTerm, showDrafted, draftResults, positionFilter, statSort, yahooStats, yahooPlayers, activeSport]);"

start_idx = orig_code.find(start_sig)
end_idx = orig_code.find(end_sig) + len(end_sig)

pool_hook = orig_code[start_idx:end_idx] + "\n"
code = orig_code[:start_idx] + orig_code[end_idx:]

# Find displayPool end
dp_end_sig = "  }, [searchTerm, myRoster, draftResults, showDrafted, positionFilter, aiNotes]);"
dp_end_idx = code.find(dp_end_sig) + len(dp_end_sig)

if dp_end_idx == len(dp_end_sig) - 1:
    print("Failed to find dp_end_sig")
    sys.exit(1)

code = code[:dp_end_idx] + "\n\n" + pool_hook + code[dp_end_idx:]

with open("src/app/draft-room/page.tsx", "w") as f:
    f.write(code)

print("Patched successfully via python.")
