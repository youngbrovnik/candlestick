import "./App.css";
import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import axios from "axios";
import { Dropdown, DropdownButton, FormCheck } from "react-bootstrap";
import { SMA, BollingerBands } from "technicalindicators";

const intervals = {
  "1일": "days",
  "1주": "weeks",
  "한 달": "months",
  "1분": "minutes/1",
  "3분": "minutes/3",
  "5분": "minutes/5",
  "10분": "minutes/10",
  "15분": "minutes/15",
  "30분": "minutes/30",
  "1시간": "minutes/60",
  "4시간": "minutes/240",
};

const indicators = ["볼륨", "이동평균선", "볼린저 밴드"];

const fetchData = async (type = "days", market = "KRW-BTC", count = 200, to = null, from = null) => {
  const url = `https://api.upbit.com/v1/candles/${type}?market=${market}&count=${count}${to ? `&to=${to}` : ""}${
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

const calculateMovingAverage = (data, period) => {
  return SMA.calculate({ period: period, values: data });
};

const calculateBollingerBands = (data, period, stdDev) => {
  return BollingerBands.calculate({
    period: period,
    values: data,
    stdDev: stdDev,
  });
};

const App = () => {
  const [marketList, setMarketList] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState("KRW-BTC");
  const [chartData, setChartData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [ma20Data, setMa20Data] = useState([]);
  const [ma60Data, setMa60Data] = useState([]);
  const [bbData, setBbData] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState("days");
  const [hasMorePastData, setHasMorePastData] = useState(true);
  const [hasMoreFutureData, setHasMoreFutureData] = useState(true);
  const [selectedIndicators, setSelectedIndicators] = useState(["볼륨"]);

  useEffect(() => {
    const fetchMarkets = async () => {
      const url = "https://api.upbit.com/v1/market/all";
      try {
        const response = await axios.get(url);
        const krwMarkets = response.data.filter((market) => market.market.startsWith("KRW-"));
        setMarketList(krwMarkets);
      } catch (error) {
        console.error("Error fetching market data: ", error);
      }
    };

    fetchMarkets();
  }, []);

  useEffect(() => {
    const getData = async () => {
      const data = await fetchData(selectedInterval, selectedMarket);
      setChartData(data);

      const closePrices = data.map((d) => d.close);
      const ma20 = calculateMovingAverage(closePrices, 20);
      const ma60 = calculateMovingAverage(closePrices, 60);
      const bb = calculateBollingerBands(closePrices, 20, 2); // 20-period Bollinger Bands with 2 standard deviations

      const ma20FullData = new Array(data.length - ma20.length).fill(null).concat(ma20);
      const ma60FullData = new Array(data.length - ma60.length).fill(null).concat(ma60);
      const bbFullData = new Array(data.length - bb.length).fill(null).concat(bb);

      setMa20Data(ma20FullData);
      setMa60Data(ma60FullData);
      setBbData(bbFullData);

      setDisplayData(data.slice(-100)); // 초기에는 최신 100개 데이터만 표시
      console.log(data);
    };

    getData();
  }, [selectedInterval, selectedMarket]);

  const fetchMoreData = async (direction) => {
    if (!chartData.length) return;

    if (direction === "past" && hasMorePastData) {
      const oldestDate = chartData[0].date;
      const toTimestamp = oldestDate.toISOString();
      const moreData = await fetchData(selectedInterval, selectedMarket, 100, toTimestamp);

      if (moreData.length) {
        setChartData((prevData) => [...moreData, ...prevData]);
      } else {
        setHasMorePastData(false);
      }
    } else if (direction === "future" && hasMoreFutureData) {
      const newestDate = chartData[chartData.length - 1].date;
      const fromTimestamp = newestDate.toISOString();
      const moreData = await fetchData(selectedInterval, selectedMarket, 100, null, fromTimestamp);

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
      console.log("Current display data:", newDisplayData); // 현재 표시되고 있는 데이터를 콘솔에 출력
    }

    if (event["xaxis.autorange"]) {
      const latestDate = displayData[displayData.length - 1]?.date;
      if (latestDate) {
        const latestVisibleIndex = chartData.findIndex((d) => d.date.getTime() === latestDate.getTime());
        const startIndex = Math.max(0, latestVisibleIndex - 99);
        const latest100Data = chartData.slice(startIndex, latestVisibleIndex + 1);
        setDisplayData(latest100Data);
        console.log("Current display data after autoscale:", latest100Data); // autoscale 후 표시되는 데이터를 콘솔에 출력
      }
    }
  };

  const handleIntervalChange = (intervalKey) => {
    setSelectedInterval(intervals[intervalKey]);
  };

  const handleMarketChange = (market) => {
    setSelectedMarket(market);
  };

  const handleIndicatorChange = (indicator) => {
    setSelectedIndicators((prevSelected) =>
      prevSelected.includes(indicator) ? prevSelected.filter((i) => i !== indicator) : [...prevSelected, indicator]
    );
  };

  const getSelectedIntervalLabel = () => {
    return Object.keys(intervals).find((key) => intervals[key] === selectedInterval);
  };

  return (
    <div className="App">
      <div className="dropdown-container">
        <DropdownButton id="dropdown-indicator-button" title="지표" className="dropdown-button">
          {indicators.map((indicator) => (
            <Dropdown.Item key={indicator} onClick={() => handleIndicatorChange(indicator)}>
              <FormCheck
                type="checkbox"
                label={indicator}
                checked={selectedIndicators.includes(indicator)}
                onChange={() => handleIndicatorChange(indicator)}
              />
            </Dropdown.Item>
          ))}
        </DropdownButton>
        <DropdownButton id="dropdown-interval-button" title={getSelectedIntervalLabel()} className="dropdown-button">
          {Object.keys(intervals).map((key) => (
            <Dropdown.Item key={key} onClick={() => handleIntervalChange(key)}>
              {key}
            </Dropdown.Item>
          ))}
        </DropdownButton>
        <DropdownButton id="dropdown-market-button" title={selectedMarket} className="dropdown-button">
          {marketList.map((market) => (
            <Dropdown.Item key={market.market} onClick={() => handleMarketChange(market.market)}>
              {market.market}
            </Dropdown.Item>
          ))}
        </DropdownButton>
      </div>
      <Plot
        data={[
          {
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
          },
          ...(selectedIndicators.includes("볼륨")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => d.volume),
                  type: "bar",
                  xaxis: "x",
                  yaxis: "y2",
                  marker: {
                    color: "rgba(31,119,180,0.5)",
                  },
                },
              ]
            : []),
          ...(selectedIndicators.includes("이동평균선")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => {
                    const index = chartData.findIndex((cd) => cd.date.getTime() === d.date.getTime());
                    return ma20Data[index];
                  }),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "red" },
                  name: "MA 20",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => {
                    const index = chartData.findIndex((cd) => cd.date.getTime() === d.date.getTime());
                    return ma60Data[index];
                  }),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "blue" },
                  name: "MA 60",
                },
              ]
            : []),
          ...(selectedIndicators.includes("볼린저 밴드")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => {
                    const index = chartData.findIndex((cd) => cd.date.getTime() === d.date.getTime());
                    return bbData[index]?.middle;
                  }),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "red" },
                  name: "BB Middle",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => {
                    const index = chartData.findIndex((cd) => cd.date.getTime() === d.date.getTime());
                    return bbData[index]?.upper;
                  }),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "black" },
                  name: "BB Upper",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => {
                    const index = chartData.findIndex((cd) => cd.date.getTime() === d.date.getTime());
                    return bbData[index]?.lower;
                  }),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "black" },
                  name: "BB Lower",
                },
              ]
            : []),
        ]}
        layout={{
          dragmode: "pan",
          width: 990,
          margin: {
            r: 10,
            t: 25,
            b: 40,
            l: 60,
          },
          showlegend: true,
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
        }}
        onRelayout={handleRelayout}
        config={{ modeBarButtonsToAdd: ["pan2d"], displayModeBar: true }}
      />
    </div>
  );
};

export default App;
