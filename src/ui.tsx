import * as React from "react"
import { useState, useEffect } from "react"
import * as ReactDOM from "react-dom"
import * as d3 from "d3"
import icons from "./icons"
import { chartTypes, dummyData, interpolationFunctions, interpolationFunctionOptions } from "./config"
import InputFile from "./InputFile"
import "./ui.css"

const chartTypeIds = Object.keys(chartTypes)
const dimensionLabelsMap = {
  sortBy: "sort by",
  x: "x axis",
  y: "y axis",
}
const defaultKeys = [
  "time", "temperatureHigh", "temperatureLow"
]
type AppProps = {}
const App: React.FunctionComponent<AppProps> = () => {
  const [data, setData] = useState(dummyData)
  const [dataType, setDataType] = useState("given")
  const [chartType, setChartType] = useState("line")
  const [fieldValues, setFieldValues] = useState({})
  const [dataKeys, setDataKeys] = useState([])
  const [selectedElementDimensions, setSelectedElementDimensions] = useState([])
  const [fileName, setFileName] = useState(null)
  const [dimensionValues, setDimensionValues] = useState({})
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const dimensions = (event.data.pluginMessage || {}).selectedDimensions
      if (dimensions && dimensions.length) {
        const largestWidth = Math.max(...dimensions.map(d => d.width))
        const largestHeight = Math.max(...dimensions.map(d => d.height))
        setSelectedElementDimensions([
          largestWidth,
          largestHeight
        ])
        if (fieldValues["width"]) {
          setFieldValues({
            ...fieldValues,
            width: largestWidth || fieldValues["width"],
            height: largestHeight || fieldValues["height"]
          })
        }
      }
    }

    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
    }
  })

  const setDataTypeLocal = (type: string) => () => {
    setDataType(type)
    setFileName(null)
    setData(dummyData)
  }

  useEffect(() => {
    if (dataType != "given" && !dataKeys.length) setDimensionValues({})
    const defaultKey = dataKeys[0]
    let newDimensionValues = {}
    chartTypes[chartType].dimensions.map((dimension: string, i: number) => {
      newDimensionValues[dimension] = dataType == "given" ? defaultKeys[i] : defaultKey
    })
    setDimensionValues(newDimensionValues)
    if (dataType == "given") {
      setDataKeys(getKeys(dummyData))
    } else if (dataType == "random") {
      setDataKeys([])
    }
  }, [dataKeys.join(","), dataType])

  useEffect(() => {
    let newFieldValues = {
      ...fieldValues,
    };
    (chartTypes[chartType].fields || []).forEach(field => {
      if (field.id === "width") {
        if (selectedElementDimensions[0] && (!fieldValues["width"] || fieldValues["width"] === selectedElementDimensions[0])) {
          newFieldValues["width"] = selectedElementDimensions[0]
          return
        }
      } else if (field.id === "height") {
        if (selectedElementDimensions[1] && (!fieldValues["height"] || fieldValues["height"] === selectedElementDimensions[1])) {
          newFieldValues["height"] = selectedElementDimensions[1]
          return
        }
      }
      newFieldValues[field.id] = field.initialValue
    });
    (chartTypes[chartType].dimensionFields || []).forEach(field => {
      newFieldValues[field.id] = field.initialValue
    })
    setFieldValues(newFieldValues)
  }, [chartType])

  const getKeys = data => {
    if (data[0].length) return null
    let keys = []
    const allKeys = Object.keys(data[0])
    allKeys.forEach(key => {
      if (!isNaN(+data[0][key])) keys.push(key)
    })
    return keys
  }
  const onDataUpload = async ({ data, file }) => {
    try {
      const keys = getKeys(data)

      if (!data || !data.length || typeof data[0] != "object" || !keys.length) {
        console.log("Error loading file")
        setUploadError("Something went wrong with loading that file.\nMake sure it's a valid CSV or JSON file and try again.")
        return
      }

      setDataType("custom")
      setFileName(file.name)
      setData(data)
      setDataKeys(keys)

      setUploadError(null)
    } catch (e) {
      console.log("Error loading file", e)
      setUploadError("Something went wrong with loading that file.\nMake sure it's a valid CSV or JSON file and try again.")
    }
  }

  const onFieldChangeLocal = (fieldId: string, newValue: string | number) => {
    setFieldValues({
      ...fieldValues,
      [fieldId]: newValue,
    })
  }
  const onDimensionChangeLocal = (dimension: string) => (e: any) => {
    const newValue = e.target.value
    setDimensionValues({
      ...dimensionValues,
      [dimension]: newValue,
    })
  }

  const onSubmit = (e: any) => {
    if (e) e.preventDefault()
    try {
      let chartConfig = {
        type: chartType,
        width: fieldValues["width"],
        height: fieldValues["height"],
        areaPath: "",
        linePath: "",
        interpolation: fieldValues["interpolation"],
      }

      let parsedData: any[] = dataType == "custom" ? data :
        dataType == "given" ? dummyData :
          dataType == "random" ? getRandomData() :
            []

      const dimensionOptions = chartTypes[chartType].dimensions

      if (dataType != "random") {
        dimensionOptions.forEach((dimension: string) => {
          const metric = dimensionValues[dimension]
          if (!metric && dimension !== "__index__") return;

          parsedData = parsedData.map((d: dataPoint, index: number) => ({
            ...d,
            [dimension]: metric === "__index__"
              ? index
              : +(d[metric] || 0),
          }))
        })
      }
      if (dataType == "random" && chartConfig.type == "line") {
        parsedData = parsedData.map((d: dataPoint, i: number) => ({
          ...d,
          x: i,
        }))
      }

      const yValues: number[] = parsedData.map((d: dataPoint) => d.y)
      const yDomain = [0, d3.max(yValues)]
      let yRange = [0, chartConfig["height"]]
      if (chartType === "scatter") {
        yRange[1] -= fieldValues["radius"] || 0
      }
      const yScale = d3.scaleLinear()
        .domain(yDomain)
        .range(yRange)

      parsedData = parsedData.map((d: dataPoint) => ({
        ...d,
        yScaled: yScale(d.y) || 0.01,
      }))

      const xValues: number[] = parsedData.map((d: dataPoint) => d.x || 0)
      const xDomain = d3.extent(xValues)
      let xRange = [0, chartConfig.width]
      if (chartType === "scatter") {
        xRange[1] -= (fieldValues["radius"] || 0)
      }
      const xScale = d3.scaleLinear()
        .domain(xDomain)
        .range(xRange)

      parsedData = parsedData.map((d: dataPoint) => ({
        ...d,
        xScaled: xScale(d.x) || 0.01,
      }))

      const colorValues: number[] = parsedData.map((d: dataPoint) => d.color || 0)
      const colorScale = d3.scaleLinear<string>()
        .domain(d3.extent(colorValues))
        .range(["#fff", "#5758BB"])

      parsedData = parsedData.map((d: dataPoint) => ({
        ...d,
        colorScaled: colorScale(d.color) || "rgb(1, 1, 1)",
      }))

      if (dimensionOptions.includes("sortBy")) {
        parsedData = parsedData.sort((a: { sortBy: number }, b: { sortBy: number }) => b.sortBy - a.sortBy)
      }

      if (chartConfig.type == "line") {
        const sortedData = parsedData.sort((a: { x: number }, b: { x: number }) => b.x - a.x)

        const accessorFunction = (key: string) => (d: any) => d[key]

        const interpolationFunction = interpolationFunctions[chartConfig.interpolation]
        const areaGenerator = d3.area()
          .x(accessorFunction("xScaled"))
          .y0(chartConfig.height)
          .y1(accessorFunction("yScaled"))
        if (interpolationFunction) areaGenerator.curve(interpolationFunction)
        chartConfig.areaPath = areaGenerator(sortedData)

        const lineGenerator = d3.line()
          .x(accessorFunction("xScaled"))
          .y(accessorFunction("yScaled"))
        if (interpolationFunction) lineGenerator.curve(interpolationFunction)
        chartConfig.linePath = lineGenerator(sortedData)
      }

      const pluginMessage = {
        type: 'draw-data',
        data: parsedData,
        fields: fieldValues,
        dimensions: dimensionValues,
        chartConfig,
      }

      parent.postMessage({
        pluginMessage,
      }, '*')
    } catch (e) {
      console.log("ISSUE!", e)
    }
  }

  const onCancel = () => {
    parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*')
  }

  return (
    <form className="wrapper" onSubmit={onSubmit}>
      <h2>
        Datavizer
      </h2>
      <div className="field button-group button-group-small">
        <button
          type="button"
          className={`data-type ${dataType == "given" ? "is-selected" : "grey"}`}
          onClick={setDataTypeLocal("given")}>
          Use example data (NYC Weather)
        </button>
        <button
          type="button"
          className={`data-type ${dataType == "random" ? "is-selected" : "grey"}`}
          onClick={setDataTypeLocal("random")}>
          Use random data
        </button>
      </div>

      <InputFile
        {...{ fileName }}
        onChange={onDataUpload}
      />
      {uploadError && (
        <div className="error">
          {uploadError}
        </div>
      )}

      <div className="field button-group">
        {chartTypeIds.map(type => (
          <button
            key={type}
            type="button"
            className={`chart-type ${chartType == type ? "is-selected" : "grey"}`}
            onClick={() => setChartType(type)}>
            {icons[type]}
            <h6>{type}</h6>
          </button>
        ))}
      </div>

      <div className="fields">
        <div className="fields-section">
          <h6>Config</h6>

          {chartTypes[chartType].fields.map(field => (
            <Field key={field.id} field={field} value={fieldValues[field.id]} onChange={onFieldChangeLocal} />
          ))}
        </div>
        <div className="fields-section">
          <h6>Dimensions</h6>
          {chartTypes[chartType].dimensions.map((dimension: string) => (
            <div className="field field-short" key={dimension}>
              <label htmlFor={dimension}>
                {dimensionLabelsMap[dimension] || dimension}
              </label>
              <select
                value={dimensionValues[dimension] || ""}
                disabled={!dataKeys.length}
                onChange={onDimensionChangeLocal(dimension)}>
                {dataType == "random" && (
                  <option value="">🌟 random 🌟</option>
                )}
                <option value="" disabled={dataKeys.length > 0}>-- none --</option>
                <option value="__index__">[row index]</option>
                {dataKeys.map(key => (
                  <option key={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {chartTypes[chartType].dimensionFields && chartTypes[chartType].dimensionFields.map(field => (
            <Field key={field.id} field={field} value={fieldValues[field.id]} onChange={onFieldChangeLocal} />
          ))}
        </div>
      </div>

      <div className="actions">
        <button type="button" className="grey" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">
          Create
        </button>
      </div>
    </form>
  )
}

ReactDOM.render(<App />, document.getElementById("react-page"))

function Field({ field, value, onChange }: { field: any, value: string, onChange: (id: string, value: string | number) => void }) {
  return (
    <div className="field field-short" key={field.id}>
      <label>
        {field.label}
      </label>
      {field.options ? (
        <select
          value={value}
          onChange={e => onChange(field.id, e.target.value)}>
          {field.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value || ""}
          type="number"
          onChange={e => onChange(field.id, +e.target.value)}
        />
      )}
    </div>
  )
}

const randomNumberGenerator = d3.randomNormal(10, 2)
const getRandomData = () => {
  const numberOfRows = 50
  return new Array(numberOfRows).fill(0).map((d: dataPoint) => ({
    x: randomNumberGenerator(),
    y: randomNumberGenerator(),
    color: randomNumberGenerator(),
  }))
}

interface dataPoint {
  readonly y: number
  readonly yScaled: number
  readonly x: number
  readonly xScaled: number
  readonly color: number
  readonly colorScaled: string
}
