export const inMemoryUsers = new Map();
export const inMemoryRefreshTokens = new Map();

export const resetInMemoryStore = () => {
  inMemoryUsers.clear();
  inMemoryRefreshTokens.clear();
};
