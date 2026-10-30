import { useEffect, useState } from "react";

export default function ModelSelector({
  selectedModel,
  setSelectedModel
}) {
  const [models, setModels] = useState([]);

  useEffect(() => {

    fetch("http://localhost:5000/chat/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data.data || []);
      })
      .catch(console.error);

  }, []);

  return (
    <select
      value={selectedModel}
      onChange={(e) => setSelectedModel(e.target.value)}
      className="bg-[#2f2f2f] px-3 py-2 rounded-xl text-white"
    >
      {models.map((model) => (
        <option key={model.id} value={model.id}>
          {model.id}
        </option>
      ))}
    </select>
  );
}