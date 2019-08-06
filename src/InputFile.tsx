import * as React from "react"
import { useState } from "react"
import * as ReactDOM from "react-dom"
import * as d3 from "d3"
import icons from "./icons"

type InputFileProps = {
    fileName: String,
    onChange: (data: any) => any,
}
const InputFile: React.FunctionComponent<InputFileProps> = ({
    fileName,
    onChange,
}) => {
    const onFileUpload = async e => {
      try {
        const file = e.target.files[0];
        const contents: string = await readUploadedFileAsText(file)
        try {
          onChange({
              data: JSON.parse(contents),
              file,
          })
        } catch(e) {
          onChange({
              data: d3.csvParse(contents),
              file,
          })
        }
      } catch(e) {
        throw Error(e)
      }
    }
  return (
    <div className={`inputfile is-${!!fileName ? "selected" : "not-selected"}`}>
      <input
        type="file"
        accept=".csv,.json"
        name="data-upload"
        id="data-upload"
        onChange={onFileUpload}
      />
      <label htmlFor="data-upload">
        { icons.upload }
        { fileName || "Or feed me a CSV or JSON file" }
      </label>
    </div>
  )
}

export default InputFile

const readUploadedFileAsText = function(inputFile: any): any {
  const temporaryFileReader = new FileReader()

  return new Promise((resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort()
      reject(new DOMException("Problem parsing input file."))
    }

    temporaryFileReader.onload = () => {
      resolve(temporaryFileReader.result)
    }
    temporaryFileReader.readAsText(inputFile)
  })
}