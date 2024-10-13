// CoinList.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import { Link } from "react-router-dom";
import { formatDate } from "./utils"; // formatDate 함수 임포트
import "./CoinList.css";

const CoinList = () => {
  const [coinData, setCoinData] = useState([]);

  useEffect(() => {
    const fetchCoinData = async () => {
      try {
        // KRW로 거래되는 모든 코인 목록 가져오기
        const marketResponse = await axios.get("https://api.upbit.com/v1/market/all");
        const krwMarkets = marketResponse.data.filter((market) => market.market.startsWith("KRW-"));

        // 코인의 수를 100개로 제한
        const limitedMarkets = krwMarkets.slice(0, 100);

        // 코인 목록을 10개씩 묶어서 배치로 나누기
        const batches = [];
        const batchSize = 10;
        for (let i = 0; i < limitedMarkets.length; i += batchSize) {
          batches.push(limitedMarkets.slice(i, i + batchSize));
        }

        // 각 배치에 대해 순차적으로 API 호출
        for (const batch of batches) {
          const batchPromises = batch.map(async (coin) => {
            // 일봉 차트 데이터 가져오기 (최근 100일)
            const candleResponse = await axios.get(
              `https://api.upbit.com/v1/candles/days?market=${coin.market}&count=100`
            );
            const candleData = candleResponse.data
              .map((d) => ({
                date: new Date(d.candle_date_time_kst),
                close: d.trade_price,
              }))
              .reverse(); // 최신 데이터를 오른쪽에 표시하기 위해 데이터 순서 뒤집기

            return {
              market: coin.market,
              korean_name: coin.korean_name,
              candleData,
            };
          });

          const batchData = await Promise.all(batchPromises);

          // 기존 코인 데이터에 배치 데이터 추가
          setCoinData((prevData) => [...prevData, ...batchData]);

          // 배치 간의 딜레이 (1초)
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error("코인 데이터를 가져오는 중 오류 발생:", error);
      }
    };

    fetchCoinData();
  }, []);

  return (
    <div className="coin-list">
      {coinData.map((coin) => (
        <div key={coin.market} className="coin-item">
          {/* 코인명을 클릭할 수 있도록 Link로 감싸기 */}
          <h3>
            <Link to={`/coins/${coin.market}`}>
              {" "}
              {/* Link 사용 */}
              {coin.korean_name} ({coin.market})
            </Link>
          </h3>
          {/* '현재 가격' 부분 제거 */}
          <Plot
            data={[
              {
                x: coin.candleData.map((d) => d.date),
                y: coin.candleData.map((d) => d.close),
                type: "scatter",
                mode: "lines",
                line: { color: "blue" },
              },
            ]}
            layout={{
              width: 300,
              height: 200,
              margin: { l: 20, r: 10, t: 10, b: 20 },
              xaxis: {
                autorange: true,
                type: "date",
                showgrid: false,
                showticklabels: false,
                title: "",
              },
              yaxis: {
                autorange: true,
                type: "linear",
                showgrid: false,
                showticklabels: false,
                title: "",
              },
            }}
            config={{ displayModeBar: false }}
          />
        </div>
      ))}
    </div>
  );
};

export default CoinList;
