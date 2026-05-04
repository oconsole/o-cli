import { ComponentProps } from "solid-js"
import markPng from "../assets/images/logo-mark.png"
import splashPng from "../assets/images/logo-splash.png"

export const Mark = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-mark"
      class={props.class}
      src={markPng}
      alt="OdooCLI Mark"
      style={{ "object-fit": "contain" }}
    />
  )
}

export const Splash = (props: Pick<ComponentProps<"img">, "ref" | "class">) => {
  return (
    <img
      ref={props.ref}
      data-component="logo-splash"
      class={props.class}
      src={splashPng}
      alt="OdooCLI Splash"
      style={{ "object-fit": "contain" }}
    />
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <text
        x="0"
        y="34"
        font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        font-size="40"
        font-weight="900"
        letter-spacing="-3"
      >
        <tspan fill="var(--text-strong)">Odoo</tspan>
        <tspan fill="var(--text-interactive-base)">CLI</tspan>
      </text>
    </svg>
  )
}
