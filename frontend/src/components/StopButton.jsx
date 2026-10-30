import {
  FiSquare
} from "react-icons/fi";

import {
  stopGeneration
} from "../services/ollama";

export default function StopButton({
  isThinking
}) {

  if (!isThinking)
    return null;

  return (

    <button
      onClick={
        stopGeneration
      }
      className="
      px-4
      h-11

      rounded-full

      bg-red-500
      hover:bg-red-600

      text-white

      flex
      items-center
      gap-2

      transition
      "
    >

      <FiSquare size={14} />

      Stop

    </button>

  );

}
