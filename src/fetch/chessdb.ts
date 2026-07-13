// This file contains functions that query the www.chessdb.cn API.
// Visit https://chessdb.cn/cloudbookc_api_en.html for api documentation

export enum Action {
  QueryAll = 'queryall',
  QueryScore = 'queryscore',
  QueryPv = 'querypv',
}

function makeUrl(action: Action, fen: string): string {
  return `http://www.chessdb.cn/cdb.php?action=${action}&board=${encodeURIComponent(fen)}`;
};

export async function queryAllKnownMoves(fen: string): Promise<string> {
  const url = makeUrl(Action.QueryAll, fen);
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const bodyText = await new Response(response.body).text();
    return bodyText;
  } catch (error) {
    throw new Error('Error fetching data');
  }
}

export async function queryScore(fen: string): Promise<string> {
  const url = makeUrl(Action.QueryScore, fen);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const bodyText = await new Response(response.body).text();
    return bodyText;
  } catch (error) {
    throw new Error('Error fetching data');
  }
}

export async function queryPv(fen: string): Promise<string> {
  const url = makeUrl(Action.QueryPv, fen);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const bodyText = await new Response(response.body).text();
    return bodyText;
  } catch (error) {
    throw new Error('Error fetching data');
  }
}
