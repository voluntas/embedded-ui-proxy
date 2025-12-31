import { render } from "preact";
import App from "./App";
import "./main.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

render(<App />, rootElement);
