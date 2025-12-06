import React, { useEffect, useState } from "react";
import { view, invoke } from "@forge/bridge";

// IDs de Jira
const CLIENT_FIELD_ID = "customfield_10121";
const RESUELTO_POR_FIELD_ID = "customfield_10128";

async function fetchCliente() {
    const ctx = await view.getContext();
    return ctx.extension.issue.fields[CLIENT_FIELD_ID]?.value || "";
}

async function fetchUsers() {
    return await invoke("getUsers");
}

// ------ EDIT: RESUELTO POR ------
export const rpEdit = ({ value, onChange }) => {
    const [cliente, setCliente] = useState("");
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const cli = await fetchCliente();
            setCliente(cli);

            const users = await fetchUsers();
            const filtered = users.filter(
                (u) => u.tipo === "Requerimiento" && u.cliente === cli
            );

            const opts = filtered.map((u) => ({
                label: u.usuario,
                value: u.usuario
            }));

            setOptions(opts);

            if (!value && opts.length > 0) {
                onChange(opts[0].value);
            }

            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return React.createElement("p", null, "Cargando usuarios…");
    }

    if (!cliente) {
        return React.createElement("p", null, "Primero seleccione un Cliente.");
    }

    if (options.length === 0) {
        return React.createElement("p", null, "No hay usuarios para el cliente.");
    }

    return React.createElement(
        "div",
        null,
        React.createElement("label", null, `Resuelto Por (${cliente})`),
        React.createElement(
            "select",
            {
                style: { width: "100%", padding: "8px", marginTop: "6px" },
                value: value || "",
                onChange: (e) => onChange(e.target.value)
            },
            options.map((o) =>
                React.createElement(
                    "option",
                    { key: o.value, value: o.value },
                    o.label
                )
            )
        )
    );
};

// ------ VIEW: RESUELTO POR ------
export const rpView = ({ value }) => {
    return React.createElement(
        "p",
        null,
        value || "Sin usuario seleccionado"
    );
};

// ------ EDIT: DPTO RESUELTO POR ------
export const rdEdit = ({ value, onChange }) => {
    const [loading, setLoading] = useState(true);
    const [departamento, setDepartamento] = useState("");

    useEffect(() => {
        async function load() {
            setLoading(true);

            const ctx = await view.getContext();
            const resueltoField = ctx.extension.issue.fields[RESUELTO_POR_FIELD_ID]?.value;

            if (!resueltoField) {
                setDepartamento("");
                onChange("");
                setLoading(false);
                return;
            }

            const cliente = await fetchCliente();
            const users = await fetchUsers();

            const match = users.find(
                (u) => u.usuario === resueltoField && u.cliente === cliente
            );

            const depto = match?.departamento || "";
            setDepartamento(depto);
            onChange(depto);

            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return React.createElement("p", null, "Cargando departamento…");
    }

    return React.createElement(
        "p",
        null,
        departamento || "Sin departamento disponible"
    );
};

// ------ VIEW: DPTO RESUELTO POR ------
export const rdView = ({ value }) => {
    return React.createElement("p", null, value || "Sin departamento disponible");
};
