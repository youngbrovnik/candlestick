import "./App.css";
import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import axios from "axios";

const fetchData = async () => {
  const type = "days";
  const count = 100;
  const url = `https://api.upbit.com/v1/candles/${type}?market=KRW-BTC&count=${count}`;

  try {
    const response = await axios.get(url);
    const transformedData = response.data
      .map((d) => ({
        date: new Date(d.timestamp),
        open: d.opening_price,
        high: d.high_price,
        low: d.low_price,
        close: d.trade_price,
        volume: d.candle_acc_trade_volume,
      }))
      .reverse(); // 최신 데이터를 오른쪽에 표시하기 위해 데이터 순서를 뒤집음
    return transformedData; // transformedData 반환
  } catch (error) {
    console.error("Error fetching data: ", error);
  }
};

const App = () => {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const getData = async () => {
      const data = await fetchData();
      setChartData(data);
    };

    getData();
  }, []);

  const trace1 = {
    x: chartData.map((d) => d.date),
    close: chartData.map((d) => d.close),
    decreasing: { line: { color: "blue" } },
    high: chartData.map((d) => d.high),
    increasing: { line: { color: "red" } },
    low: chartData.map((d) => d.low),
    open: chartData.map((d) => d.open),
    type: "candlestick",
    xaxis: "x",
    yaxis: "y",
  };

  const trace2 = {
    x: chartData.map((d) => d.date),
    y: chartData.map((d) => d.volume),
    type: "bar",
    xaxis: "x",
    yaxis: "y2",
    marker: {
      color: "rgba(31,119,180,0.5)",
    },
  };

  const layout = {
    dragmode: "zoom",
    margin: {
      r: 10,
      t: 25,
      b: 40,
      l: 60,
    },
    showlegend: false,
    xaxis: {
      autorange: true,
      domain: [0, 1],
      // rangeslider: { range: [chartData[0]?.date, chartData[chartData.length - 1]?.date] },
      title: "Date",
      type: "date",
      rangeslider: { visible: false },
    },
    yaxis: {
      autorange: true,
      domain: [0.3, 1],
      type: "linear",
    },
    yaxis2: {
      autorange: true,
      domain: [0, 0.2],
      type: "linear",
    },
    grid: {
      rows: 2,
      columns: 1,
      subplots: [["xy"], ["xy2"]],
    },
  };

  return (
    <div className="App">
      <Plot data={[trace1, trace2]} layout={layout} />
    </div>
  );
};

export default App;
