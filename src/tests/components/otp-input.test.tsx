import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OtpInput } from "@/components/auth/otp-input";

describe("OtpInput", () => {
  it("renders six digit inputs", () => {
    render(<OtpInput value="" onChange={() => {}} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);
  });

  it("calls onChange with pasted 6-digit code", () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);
    const first = screen.getAllByRole("textbox")[0];

    fireEvent.paste(first, {
      clipboardData: { getData: () => "123456" },
    });

    expect(onChange).toHaveBeenCalledWith("123456");
  });

  it("calls onComplete when six digits entered via paste", () => {
    const onComplete = vi.fn();
    render(<OtpInput value="" onChange={() => {}} onComplete={onComplete} />);
    const first = screen.getAllByRole("textbox")[0];

    fireEvent.paste(first, {
      clipboardData: { getData: () => "654321" },
    });

    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  it("updates value when typing a digit in the first box", () => {
    const onChange = vi.fn();
    render(<OtpInput value="" onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith("1");
  });
});
