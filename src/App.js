import "./App.css";
import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import axios from "axios";

const fetchData = async (count = 200, to = null, from = null) => {
  const type = "days";
  const url = `https://api.upbit.com/v1/candles/${type}?market=KRW-BTC&count=${count}${to ? `&to=${to}` : ""}${
    from ? `&from=${from}` : ""
  }`;

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
    return [];
  }
};

const App = () => {
  const [chartData, setChartData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [hasMorePastData, setHasMorePastData] = useState(true);
  const [hasMoreFutureData, setHasMoreFutureData] = useState(true);

  useEffect(() => {
    const getData = async () => {
      const data = await fetchData();
      setChartData(data);
      setDisplayData(data.slice(-100)); // 초기에는 최신 100개 데이터만 표시
      console.log(data);
    };

    getData();
  }, []);

  const fetchMoreData = async (direction) => {
    if (!chartData.length) return;

    if (direction === "past" && hasMorePastData) {
      const oldestDate = chartData[0].date;
      const toTimestamp = oldestDate.toISOString();
      const moreData = await fetchData(100, toTimestamp);

      if (moreData.length) {
        setChartData((prevData) => [...moreData, ...prevData]);
      } else {
        setHasMorePastData(false);
      }
    } else if (direction === "future" && hasMoreFutureData) {
      const newestDate = chartData[chartData.length - 1].date;
      const fromTimestamp = newestDate.toISOString();
      const moreData = await fetchData(100, null, fromTimestamp);

      if (moreData.length) {
        setChartData((prevData) => [...prevData, ...moreData]);
      } else {
        setHasMoreFutureData(false);
      }
    }
  };

  const handleRelayout = (event) => {
    const xRangeStart = event["xaxis.range[0]"];
    const xRangeEnd = event["xaxis.range[1]"];

    if (xRangeStart && new Date(xRangeStart) < chartData[0].date) {
      fetchMoreData("past");
    } else if (xRangeEnd && new Date(xRangeEnd) > chartData[chartData.length - 1].date) {
      fetchMoreData("future");
    }

    if (xRangeStart && xRangeEnd) {
      const newDisplayData = chartData.filter(
        (d) => new Date(d.date) >= new Date(xRangeStart) && new Date(d.date) <= new Date(xRangeEnd)
      );
      setDisplayData(newDisplayData);
    }
  };

  const trace1 = {
    x: displayData.map((d) => d.date),
    close: displayData.map((d) => d.close),
    decreasing: { line: { color: "blue" } },
    high: displayData.map((d) => d.high),
    increasing: { line: { color: "red" } },
    low: displayData.map((d) => d.low),
    open: displayData.map((d) => d.open),
    type: "candlestick",
    xaxis: "x",
    yaxis: "y",
  };

  const trace2 = {
    x: displayData.map((d) => d.date),
    y: displayData.map((d) => d.volume),
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
      <Plot data={[trace1, trace2]} layout={layout} onRelayout={handleRelayout} />
    </div>
  );
};

export default App;
