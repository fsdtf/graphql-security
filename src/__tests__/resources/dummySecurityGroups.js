
export const A = {
    name: 'ALPHA',
    rules: {},
}

export const B = {
    name: 'Bravo',
}

export const C = {
    name: 'Charlie',
    rules: {
        Employee: {
            row: {
                isDisabled: false,
            },
            col: {
                id: {
                    subordinate: true,
                },
            },
        },
    },
}

export const D = {
    name: 'Delta',
    rules: {
        Employee: {
            row: {
                isDisabled: true,
                own: true,
            },
            col: {
                id: {
                    own: true,
                    subordinate: false,
                },
            },
        },
    },
}
