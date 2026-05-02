let n = 0;
export const newTileId = () => `t_${(++n).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
