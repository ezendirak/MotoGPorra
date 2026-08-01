import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

/**
 * Además del preset de Next, aquí se codifican las reglas de arquitectura
 * de docs/DESIGN.md §11.4, para que las verifique el linter y no la disciplina.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // El tipado es estricto: un `any` explícito debe ser una decisión consciente.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Regla 1: el acceso a Supabase está centralizado en lib/supabase/.
    // Nadie más instancia un cliente.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/supabase/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message:
                'No instancies clientes de Supabase aquí. Usa @/lib/supabase/{server,client,admin}.',
            },
            {
              name: '@supabase/ssr',
              message:
                'No instancies clientes de Supabase aquí. Usa @/lib/supabase/{server,client,admin}.',
            },
          ],
        },
      ],
    },
  },

  {
    // Regla 2: utils/ son funciones puras, sin dependencias del proyecto.
    files: ['src/utils/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              message:
                'src/utils/ debe contener funciones puras sin dependencias del proyecto.',
            },
          ],
        },
      ],
    },
  },

  {
    // Regla 3: services/ es lógica de negocio testeable, sin JSX ni React.
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'services/ no debe depender de React.' },
            { name: 'react-dom', message: 'services/ no debe depender de React.' },
          ],
        },
      ],
    },
  },

  // Desactiva las reglas de ESLint que chocan con Prettier. Debe ir el último.
  prettier,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
