export const NICKNAME_MIN_LEN = 2;
export const NICKNAME_MAX_LEN = 20;

const NICKNAME_PATTERN = /^[a-zA-Z]+( [a-zA-Z]+)*$/;

export interface NicknameValidation {
  isValid: boolean;
  error?: string;
}

export const validateNickname = (raw: string): NicknameValidation => {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "nickname can't be empty" };
  }
  if (trimmed.length < NICKNAME_MIN_LEN) {
    return {
      isValid: false,
      error: `at least ${NICKNAME_MIN_LEN} letters please`,
    };
  }
  if (trimmed.length > NICKNAME_MAX_LEN) {
    return {
      isValid: false,
      error: `keep it under ${NICKNAME_MAX_LEN} characters`,
    };
  }
  if (!NICKNAME_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: "letters and single spaces only — no numbers or symbols",
    };
  }
  return { isValid: true };
};

export const sanitizeNickname = (raw: string | null | undefined): string => {
  if (!raw) return "User";
  const cleaned = raw.replace(/[^a-zA-Z\s]/g, "");
  const collapsed = cleaned.replace(/\s+/g, " ").trim();
  const truncated = collapsed.slice(0, NICKNAME_MAX_LEN).trim();
  if (truncated.length < NICKNAME_MIN_LEN) return "User";
  return truncated;
};