/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React from 'react';

interface CecilPinesPinesProps {
  className?: string;
  color?: string;
}

/**
 * Three Golden Pines emblem vector directly matching the Cecil Pines logo mark,
 * with fully transparent background.
 */
export const CecilPinesPines: React.FC<CecilPinesPinesProps> = ({
  className = 'w-10 h-10',
  color
}) => {
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cecil Pines Emblem"
    >
      <defs>
        <linearGradient id="cpGoldShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color || "#FAD06C"} />
          <stop offset="45%" stopColor={color || "#DFA327"} />
          <stop offset="100%" stopColor={color || "#B88218"} />
        </linearGradient>
      </defs>

      {/* Trunks */}
      <path d="M 112 165 L 115 210 Q 118 212 121 210 L 124 165 Z" fill="#996515" />
      <path d="M 154 160 L 157 215 Q 160 218 163 215 L 166 160 Z" fill="#996515" />
      <path d="M 196 165 L 199 210 Q 202 212 205 210 L 208 165 Z" fill="#996515" />

      {/* Left Pine Tree (Foliage) */}
      <path
        d="
          M 118 42
          C 114 44 110 49 113 54
          C 107 53 103 58 106 64
          C 100 64 96 70 100 77
          C 94 77 89 83 93 91
          C 86 91 82 98 86 106
          C 78 106 74 114 78 123
          C 70 124 67 133 72 142
          C 64 144 63 154 70 162
          C 77 170 90 172 105 170
          C 115 169 126 166 135 160
          C 142 155 146 148 143 140
          C 148 132 147 122 141 115
          C 145 106 143 96 137 90
          C 141 82 138 73 131 68
          C 134 60 130 52 124 47
          Z
        "
        fill="url(#cpGoldShine)"
      />

      {/* Right Pine Tree (Foliage) */}
      <path
        d="
          M 202 44
          C 196 46 193 53 197 60
          C 190 62 188 70 193 77
          C 186 79 184 88 189 96
          C 182 98 180 108 186 116
          C 178 118 176 128 182 137
          C 174 139 173 150 180 159
          C 187 168 200 171 216 169
          C 228 167 240 163 249 156
          C 256 150 258 140 252 133
          C 257 125 256 115 250 107
          C 254 99 252 89 245 82
          C 248 74 245 65 238 59
          C 240 51 235 44 227 41
          C 220 40 214 43 210 48
          Z
        "
        fill="url(#cpGoldShine)"
      />

      {/* Center Pine Tree (Tallest) */}
      <path
        d="
          M 160 18
          C 156 19 152 24 155 29
          C 149 28 145 33 148 39
          C 142 39 138 45 142 52
          C 135 52 131 59 136 67
          C 129 67 125 75 130 83
          C 122 84 119 92 124 101
          C 116 102 113 111 118 120
          C 110 122 108 132 114 141
          C 107 144 106 154 113 162
          C 121 170 135 173 150 171
          C 160 170 170 170 180 171
          C 195 173 209 170 217 162
          C 224 154 223 144 216 141
          C 222 132 220 122 212 120
          C 217 111 214 102 206 101
          C 211 92 208 84 200 83
          C 205 75 201 67 194 67
          C 199 59 195 52 188 52
          C 192 45 188 39 182 39
          C 185 33 181 28 175 29
          C 178 24 174 19 170 18
          C 165 17 163 17 160 18
          Z
        "
        fill="url(#cpGoldShine)"
      />

      {/* Soft highlight accents */}
      <g fill="#FFF" opacity="0.18">
        <circle cx="160" cy="40" r="5" />
        <circle cx="150" cy="65" r="7" />
        <circle cx="170" cy="62" r="6" />
        <circle cx="140" cy="95" r="8" />
        <circle cx="180" cy="90" r="8" />
        <circle cx="120" cy="80" r="6" />
        <circle cx="200" cy="82" r="6" />
      </g>
    </svg>
  );
};
