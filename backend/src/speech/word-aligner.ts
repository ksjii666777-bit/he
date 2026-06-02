export function alignWords(
  referenceText: string,
  spokenWords: { word: string; confidence: number }[],
): { refWord: string; spokenWord: string | null; score: number; confidence: number }[] {
  const refWords = referenceText.toLowerCase().split(/\s+/);
  const spWords = spokenWords.map((w) => w.word.toLowerCase());

  const n = refWords.length;
  const m = spWords.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(Infinity),
  );
  dp[0][0] = 0;

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i < n && j < m) {
        const cost = refWords[i] === spWords[j] ? 0 : 1;
        dp[i + 1][j + 1] = Math.min(dp[i + 1][j + 1], dp[i][j] + cost);
      }
      if (i < n) {
        dp[i + 1][j] = Math.min(dp[i + 1][j], dp[i][j] + 1);
      }
      if (j < m) {
        dp[i][j + 1] = Math.min(dp[i][j + 1], dp[i][j] + 1);
      }
    }
  }

  const alignment: { refWord: string; spokenWord: string | null; score: number; confidence: number }[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (refWords[i - 1] === spWords[j - 1] ? 0 : 1)) {
      const isMatch = refWords[i - 1] === spWords[j - 1];
      alignment.unshift({
        refWord: refWords[i - 1],
        spokenWord: spWords[j - 1],
        score: isMatch ? Math.round(60 + (spokenWords[j - 1]?.confidence || 0) * 40) : Math.round((spokenWords[j - 1]?.confidence || 0) * 50),
        confidence: spokenWords[j - 1]?.confidence || 0,
      });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      alignment.unshift({
        refWord: refWords[i - 1],
        spokenWord: null,
        score: 0,
        confidence: 0,
      });
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      j--;
    } else {
      break;
    }
  }

  while (i > 0) {
    alignment.unshift({ refWord: refWords[i - 1], spokenWord: null, score: 0, confidence: 0 });
    i--;
  }

  return alignment;
}
