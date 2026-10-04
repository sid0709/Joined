import React from "react";
import { Box, Button } from "@mui/material";
import PropertyRow from "./PropertyRow";

const RecursiveObjectEditor = ({ objectSchemaDef, onUpdate }) => {
  const def = objectSchemaDef || { type: "object", properties: {}, required: [] };
  const properties = def.properties || {};
  const required = def.required || [];

  const updateProperty = (oldName, newName, newDef) => {
    const newProps = { ...properties };
    if (oldName !== newName && oldName in newProps) {
      const val = newProps[oldName];
      delete newProps[oldName];
      newProps[newName] = val;
    }
    if (newDef) newProps[newName] = newDef;
    const newReq = required.map((r) => (r === oldName ? newName : r));
    onUpdate({ ...def, properties: newProps, required: newReq });
  };

  const deleteProperty = (propName) => {
    const newProps = { ...properties };
    delete newProps[propName];
    const newReq = required.filter((r) => r !== propName);
    onUpdate({ ...def, properties: newProps, required: newReq });
  };

  const toggleRequired = (propName) => {
    const isReq = required.includes(propName);
    const nextReq = isReq ? required.filter((r) => r !== propName) : [...required, propName];
    onUpdate({ ...def, required: nextReq });
  };

  const addProperty = () => {
    let base = "newProperty";
    let i = 1;
    let name = base;
    while (properties[name]) name = `${base}${i++}`;
    onUpdate({
      ...def,
      properties: { ...properties, [name]: { type: "string", description: "" } },
    });
  };

  return (
    <Box sx={{ mt: 1 }}>
      {Object.entries(properties).map(([name, pdef]) => (
        <Box key={name} sx={{ mb: 1 }}>
          <PropertyRow
            propName={name}
            propDef={pdef}
            isRequired={required.includes(name)}
            onNameChange={(newName) => updateProperty(name, newName, null)}
            onDefChange={(newDef) => updateProperty(name, name, newDef)}
            onDelete={() => deleteProperty(name)}
            onToggleRequired={() => toggleRequired(name)}
          />
          {(pdef?.type === "object" ||
            (pdef?.type === "array" && pdef.items?.type === "object")) && (
            <Box sx={{ ml: 3 }}>
              <RecursiveObjectEditor
                objectSchemaDef={pdef.type === "object" ? pdef : pdef.items}
                onUpdate={(updated) => {
                  if (pdef.type === "object") updateProperty(name, name, updated);
                  else updateProperty(name, name, { ...pdef, items: updated });
                }}
              />
            </Box>
          )}
        </Box>
      ))}
      <Button size="small" onClick={addProperty}>
        Add Property
      </Button>
    </Box>
  );
};

export default RecursiveObjectEditor;
