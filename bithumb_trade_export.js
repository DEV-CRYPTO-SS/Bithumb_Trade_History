javascript: (() => {
    const existingPanel = document.getElementById('bithumb-export-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    let isAutoLoading = false;
    let autoLoadingInterval = null;

    async function autoLoadDataUntilDate(targetDate) {
        if (isAutoLoading) {
            showNotification('이미 데이터를 불러오는 중입니다.');
            return;
        }

        isAutoLoading = true;
        let clickCount = 0;
        const maxClicks = 1000;

        const loadingPanel = document.createElement('div');
        loadingPanel.id = 'auto-loading-panel';
        loadingPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 32px 48px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            z-index: 100000;
            text-align: center;
            min-width: 400px;
        `;
        loadingPanel.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; color: #1e293b;">데이터 자동 로딩 중...</h3>
            <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px;">
                목표 날짜: <strong>${targetDate.toLocaleDateString()}</strong>
            </p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                <div style="font-size: 32px; font-weight: 700; color: #667eea; margin-bottom: 8px;" id="click-count">0</div>
                <div style="font-size: 14px; color: #64748b;">클릭 횟수</div>
            </div>
            <div style="background: #fef3c7; padding: 12px; border-radius: 10px; margin-bottom: 16px;">
                <div style="font-size: 13px; color: #92400e;">
                    <strong>현재 최하단 날짜:</strong> <span id="current-oldest-date">확인 중...</span>
                </div>
            </div>
            <button id="stop-loading" style="padding: 12px 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s;">
                중지
            </button>
        `;
        document.body.appendChild(loadingPanel);

        document.getElementById('stop-loading').addEventListener('click', () => {
            isAutoLoading = false;
            loadingPanel.remove();
            showNotification('데이터 로딩이 중지되었습니다.');
        });

        const clickMoreButton = () => {
            return new Promise((resolve) => {
                const moreButton = document.querySelector('.TradeHistory_trade-history__button-more__LhYqK');

                if (!moreButton) {
                    resolve({ success: false, reason: 'button_not_found' });
                    return;
                }

                const rows = document.querySelectorAll('[role="row"]');
                let oldestDate = null;

                for (let i = rows.length - 1; i >= 0; i--) {
                    const dateCell = rows[i].querySelector('[class*="list-content-item--order-date"]');
                    if (dateCell && dateCell.textContent.trim()) {
                        const dateStr = dateCell.textContent.trim();
                        oldestDate = parseDate(dateStr);
                        break;
                    }
                }

                const dateDisplay = document.getElementById('current-oldest-date');
                if (dateDisplay && oldestDate) {
                    dateDisplay.textContent = oldestDate.toLocaleString();
                }

                if (oldestDate && oldestDate <= targetDate) {
                    resolve({ success: true, reason: 'target_reached', oldestDate });
                    return;
                }

                clickCount++;
                document.getElementById('click-count').textContent = clickCount;
                moreButton.click();

                setTimeout(() => {
                    resolve({ success: true, reason: 'continue' });
                }, 500);
            });
        };

        try {
            while (isAutoLoading && clickCount < maxClicks) {
                const result = await clickMoreButton();

                if (!result.success) {
                    loadingPanel.remove();
                    isAutoLoading = false;
                    showNotification('더보기 버튼을 찾을 수 없습니다.');
                    break;
                }

                if (result.reason === 'target_reached') {
                    loadingPanel.remove();
                    isAutoLoading = false;
                    showNotification(`✅ 목표 날짜까지 모든 데이터를 불러왔습니다! (${clickCount}회 클릭)`);

                    const panel = document.getElementById('bithumb-export-panel');
                    if (panel) {
                        panel.remove();
                        setTimeout(() => {
                            document.querySelector('a[href*="bithumb_trade_export"]')?.click();
                        }, 500);
                    }
                    break;
                }
            }

            if (clickCount >= maxClicks) {
                loadingPanel.remove();
                isAutoLoading = false;
                showNotification('⚠️ 최대 클릭 횟수에 도달했습니다. 더 오래된 데이터가 필요하면 다시 실행하세요.');
            }
        } catch (error) {
            loadingPanel.remove();
            isAutoLoading = false;
            showNotification('오류가 발생했습니다: ' + error.message);
        }
    }

    function parseDate(dateStr) {
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
    }

    function extractTradeData() {
        const rows = document.querySelectorAll('[role="row"]');
        const trades = [];

        rows.forEach(row => {
            const dateCell = row.querySelector('[class*="list-content-item--order-date"]');
            const assetCell = row.querySelector('[class*="list-content-item--asset"]');
            const typeCell = row.querySelector('[class*="list-content-item--type"]');
            const quantityCell = row.querySelectorAll('[role="cell"]')[3];
            const priceCell = row.querySelector('[class*="count-unit-price"]');
            const amountCell = row.querySelectorAll('[role="cell"]')[5];
            const feeCell = row.querySelectorAll('[role="cell"]')[6];
            const settlementCell = row.querySelector('[class*="list-content-item--up"], [class*="list-content-item--down"]');
            const statusCell = row.querySelector('[class*="list-content-item--status"]');

            if (!dateCell || !assetCell || !typeCell) return;

            const date = dateCell.textContent.trim();
            const assetName = assetCell.childNodes[0]?.textContent?.trim() || '';
            const assetPair = assetCell.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const type = typeCell.textContent.trim();
            const quantity = quantityCell?.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const price = priceCell?.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const amount = amountCell?.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const fee = feeCell?.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const settlement = settlementCell?.querySelector('.AutoScale_auto-scale__nPrFi span')?.textContent?.trim() || '';
            const status = statusCell?.textContent?.trim() || '';

            const feeUnit = feeCell?.querySelector('.TradeHistory_trade-history__content-sub-item__MFZHO')?.textContent?.trim() || '';
            const settlementUnit = settlementCell?.querySelector('.TradeHistory_trade-history__content-sub-item__MFZHO')?.textContent?.trim() || '';

            trades.push({
                date, assetName, assetPair, type, quantity, price, amount, fee, feeUnit, settlement, settlementUnit, status
            });
        });

        return trades;
    }

    function parseNumber(str) {
        if (!str || str === '-') return 0;
        return Number(str.replace(/[,+]/g, ''));
    }

    function calculateStats(trades, filterType = null, filterAsset = null, filterDateFrom = null, filterDateTo = null) {
        let filtered = trades;

        if (filterType) {
            filtered = filtered.filter(t => t.type === filterType);
        }

        if (filterAsset) {
            filtered = filtered.filter(t => t.assetName.includes(filterAsset) || t.assetPair.includes(filterAsset));
        }

        if (filterDateFrom || filterDateTo) {
            filtered = filtered.filter(t => {
                const tradeDate = parseDate(t.date);
                if (filterDateFrom && tradeDate < filterDateFrom) return false;
                if (filterDateTo && tradeDate > filterDateTo) return false;
                return true;
            });
        }

        const stats = {
            count: filtered.length,
            totalSettlement: 0,
            totalFee: 0,
            totalAmount: 0,
            buyCount: 0,
            sellCount: 0,
            buyAmount: 0,
            sellAmount: 0,
            depositCount: 0,
            withdrawCount: 0,
            types: {},
            assets: {}
        };

        filtered.forEach(trade => {
            const settlement = parseNumber(trade.settlement);
            const fee = parseNumber(trade.fee);
            const amount = parseNumber(trade.amount);

            const isKRWSettlement = trade.settlementUnit === '원';
            const isKRWFee = trade.feeUnit === '원';

            if (isKRWSettlement) {
                stats.totalSettlement += settlement;
            }

            if (isKRWFee) {
                stats.totalFee += fee;
            }

            stats.totalAmount += Math.abs(amount);

            if (!stats.types[trade.type]) {
                stats.types[trade.type] = { count: 0, settlement: 0, fee: 0 };
            }
            stats.types[trade.type].count++;
            if (isKRWSettlement) {
                stats.types[trade.type].settlement += settlement;
            }
            if (isKRWFee) {
                stats.types[trade.type].fee += fee;
            }

            const assetKey = trade.assetPair || trade.assetName;
            if (!stats.assets[assetKey]) {
                stats.assets[assetKey] = { count: 0, settlement: 0, fee: 0 };
            }
            stats.assets[assetKey].count++;
            if (isKRWSettlement) {
                stats.assets[assetKey].settlement += settlement;
            }
            if (isKRWFee) {
                stats.assets[assetKey].fee += fee;
            }

            if (trade.type === '매수') {
                stats.buyCount++;
                if (isKRWSettlement) {
                    stats.buyAmount += Math.abs(settlement);
                }
            } else if (trade.type === '매도') {
                stats.sellCount++;
                if (isKRWSettlement) {
                    stats.sellAmount += Math.abs(settlement);
                }
            } else if (trade.type.includes('입금')) {
                stats.depositCount++;
            } else if (trade.type.includes('출금')) {
                stats.withdrawCount++;
            }
        });

        return { stats, filtered };
    }

    function exportToCSV(trades) {
        const headers = ['거래일시', '자산명', '거래쌍', '거래구분', '거래수량', '체결가격', '거래금액', '수수료', '정산금액', '상태'];
        const rows = trades.map(t => [
            t.date, t.assetName, t.assetPair, t.type, t.quantity, t.price, t.amount, t.fee, t.settlement, t.status
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bithumb_trades_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('클립보드에 복사되었습니다!');
        });
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 100001;
            font-weight: 600;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    const trades = extractTradeData();
    let currentFilter = {
        type: null,
        asset: null,
        search: '',
        searchInput: '',
        dateFrom: null,
        dateTo: null
    };

    function renderUI() {
        const { stats: allStats } = calculateStats(trades);

        const { stats, filtered } = calculateStats(
            trades,
            currentFilter.type,
            currentFilter.asset,
            currentFilter.dateFrom,
            currentFilter.dateTo
        );

        const searchFiltered = currentFilter.search
            ? filtered.filter(t =>
                Object.values(t).some(v =>
                    String(v).toLowerCase().includes(currentFilter.search.toLowerCase())
                )
            )
            : filtered;

        const panel = document.getElementById('bithumb-export-panel-content');
        if (!panel) return;

        const allDates = trades.map(t => parseDate(t.date));
        const maxDate = new Date(Math.max(...allDates));
        const formatDateForInput = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        panel.innerHTML = `
            <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px; display: flex; gap: 8px;">
                    <input type="text" id="search-input" placeholder="🔍 검색..." 
                        value="${currentFilter.searchInput}"
                        style="flex: 1; padding: 12px 16px; border: 2px solid #e0e7ff; border-radius: 10px; font-size: 14px; outline: none; transition: all 0.3s;">
                    <button id="search-btn" style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; white-space: nowrap;">
                        검색
                    </button>
                </div>
                <select id="type-filter" style="padding: 12px 16px; border: 2px solid #e0e7ff; border-radius: 10px; font-size: 14px; outline: none; cursor: pointer; background: white;">
                    <option value="">전체 거래구분</option>
                    ${Object.keys(allStats.types).map(type =>
            `<option value="${type}" ${currentFilter.type === type ? 'selected' : ''}>${type} (${allStats.types[type].count})</option>`
        ).join('')}
                </select>
                <select id="asset-filter" style="padding: 12px 16px; border: 2px solid #e0e7ff; border-radius: 10px; font-size: 14px; outline: none; cursor: pointer; background: white;">
                    <option value="">전체 자산</option>
                    ${Object.keys(allStats.assets).map(asset =>
            `<option value="${asset}" ${currentFilter.asset === asset ? 'selected' : ''}>${asset} (${allStats.assets[asset].count})</option>`
        ).join('')}
                </select>
            </div>

            <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                    📅 기간 필터 & 자동 데이터 로딩
                </h3>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 14px; color: #64748b; font-weight: 500;">시작일:</label>
                        <input type="date" id="date-from" 
                            value="${currentFilter.dateFrom ? formatDateForInput(currentFilter.dateFrom) : ''}"
                            max="${formatDateForInput(maxDate)}"
                            style="padding: 10px 14px; border: 2px solid #e0e7ff; border-radius: 10px; font-size: 14px; outline: none; cursor: pointer;">
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 14px; color: #64748b; font-weight: 500;">종료일:</label>
                        <input type="date" id="date-to" 
                            value="${currentFilter.dateTo ? formatDateForInput(currentFilter.dateTo) : ''}"
                            max="${formatDateForInput(maxDate)}"
                            style="padding: 10px 14px; border: 2px solid #e0e7ff; border-radius: 10px; font-size: 14px; outline: none; cursor: pointer;">
                    </div>
                    <button id="apply-date-filter" style="padding: 10px 20px; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s;">
                        적용
                    </button>
                    <button id="clear-date-filter" style="padding: 10px 20px; background: #f1f5f9; color: #64748b; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s;">
                        초기화
                    </button>
                    ${currentFilter.dateFrom || currentFilter.dateTo ? `
                        <div style="padding: 8px 16px; background: #dbeafe; color: #1e40af; border-radius: 8px; font-size: 13px; font-weight: 600;">
                            ${currentFilter.dateFrom ? formatDateForInput(currentFilter.dateFrom) : '시작'} ~ ${currentFilter.dateTo ? formatDateForInput(currentFilter.dateTo) : '종료'}
                        </div>
                    ` : ''}
                </div>
                
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 16px; border-radius: 12px; border: 2px solid #fbbf24;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 20px;">🚀</span>
                        <h4 style="margin: 0; font-size: 15px; color: #78350f; font-weight: 700;">자동 데이터 로딩</h4>
                    </div>
                    <p style="margin: 0 0 12px 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                        특정 날짜까지의 모든 거래 내역을 자동으로 불러옵니다. "더보기" 버튼을 자동으로 클릭하여 데이터를 로딩합니다.
                    </p>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <label style="font-size: 14px; color: #78350f; font-weight: 600;">목표 날짜:</label>
                        <input type="date" id="auto-load-target-date" 
                            max="${formatDateForInput(maxDate)}"
                            style="padding: 10px 14px; border: 2px solid #fbbf24; border-radius: 10px; font-size: 14px; outline: none; cursor: pointer; background: white;">
                        <button id="start-auto-load" style="padding: 10px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                            ⚡ 자동 로딩 시작
                        </button>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 16px; color: white; box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">총 거래 건수</div>
                    <div style="font-size: 32px; font-weight: 700;">${searchFiltered.length}</div>
                </div>
                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 16px; color: white; box-shadow: 0 4px 20px rgba(240, 147, 251, 0.4);">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">총 정산금액</div>
                    <div style="font-size: 28px; font-weight: 700;">${stats.totalSettlement.toLocaleString()}</div>
                </div>
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 20px; border-radius: 16px; color: white; box-shadow: 0 4px 20px rgba(79, 172, 254, 0.4);">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">총 수수료</div>
                    <div style="font-size: 28px; font-weight: 700;">${stats.totalFee.toLocaleString()}</div>
                </div>
                <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 20px; border-radius: 16px; color: white; box-shadow: 0 4px 20px rgba(67, 233, 123, 0.4);">
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">매수 / 매도</div>
                    <div style="font-size: 24px; font-weight: 700;">${stats.buyCount} / ${stats.sellCount}</div>
                </div>
            </div>

            <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">거래 유형별 통계</h3>
                <div style="display: grid; gap: 12px;">
                    ${Object.entries(stats.types).map(([type, data]) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8fafc; border-radius: 10px;">
                            <div>
                                <span style="font-weight: 600; color: #334155;">${type}</span>
                                <span style="color: #64748b; margin-left: 8px;">${data.count}건</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; color: ${data.settlement >= 0 ? '#10b981' : '#ef4444'};">
                                    ${data.settlement >= 0 ? '+' : ''}${data.settlement.toLocaleString()}
                                </div>
                                <div style="font-size: 12px; color: #94a3b8;">수수료: ${data.fee.toLocaleString()}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">거래 내역 (${searchFiltered.length}건)</h3>
                <div style="max-height: 400px; overflow-y: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 1;">
                            <tr>
                                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">일시</th>
                                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">자산</th>
                                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">구분</th>
                                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">수량</th>
                                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">가격</th>
                                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 600;">정산금액</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${searchFiltered.slice(0, 100).map((trade, idx) => `
                                <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}">
                                    <td style="padding: 10px 8px; color: #64748b;">${trade.date}</td>
                                    <td style="padding: 10px 8px; font-weight: 500; color: #334155;">${trade.assetPair || trade.assetName}</td>
                                    <td style="padding: 10px 8px;">
                                        <span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; 
                                            ${trade.type === '매수' ? 'background: #dbeafe; color: #1e40af;' :
                trade.type === '매도' ? 'background: #fee2e2; color: #991b1b;' :
                    'background: #f3f4f6; color: #374151;'}">
                                            ${trade.type}
                                        </span>
                                    </td>
                                    <td style="padding: 10px 8px; text-align: right; color: #475569;">${trade.quantity}</td>
                                    <td style="padding: 10px 8px; text-align: right; color: #475569;">${trade.price}</td>
                                    <td style="padding: 10px 8px; text-align: right; font-weight: 600; 
                                        color: ${parseNumber(trade.settlement) >= 0 ? '#10b981' : '#ef4444'};">
                                        ${trade.settlement}
                                    </td>
                                </tr>
                            `).join('')}
                            ${searchFiltered.length > 100 ? `
                                <tr>
                                    <td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">
                                        처음 100건만 표시됩니다. CSV로 내보내기하여 전체 데이터를 확인하세요.
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button id="export-csv" style="flex: 1; min-width: 150px; padding: 14px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                    📥 CSV 내보내기
                </button>
                <button id="copy-stats" style="flex: 1; min-width: 150px; padding: 14px 24px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);">
                    📋 통계 복사
                </button>
                <button id="reset-filter" style="flex: 1; min-width: 150px; padding: 14px 24px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);">
                    🔄 필터 초기화
                </button>
            </div>
        `;

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            currentFilter.searchInput = e.target.value;
        });

        document.getElementById('search-btn').addEventListener('click', () => {
            currentFilter.search = currentFilter.searchInput;
            renderUI();
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                currentFilter.search = currentFilter.searchInput;
                renderUI();
            }
        });

        document.getElementById('type-filter').addEventListener('change', (e) => {
            currentFilter.type = e.target.value || null;
            renderUI();
        });

        document.getElementById('asset-filter').addEventListener('change', (e) => {
            currentFilter.asset = e.target.value || null;
            renderUI();
        });

        document.getElementById('apply-date-filter').addEventListener('click', () => {
            const dateFromInput = document.getElementById('date-from').value;
            const dateToInput = document.getElementById('date-to').value;

            if (dateFromInput) {
                const [year, month, day] = dateFromInput.split('-').map(Number);
                currentFilter.dateFrom = new Date(year, month - 1, day, 0, 0, 0);
            }

            if (dateToInput) {
                const [year, month, day] = dateToInput.split('-').map(Number);
                currentFilter.dateTo = new Date(year, month - 1, day, 23, 59, 59);
            }

            renderUI();
        });

        document.getElementById('clear-date-filter').addEventListener('click', () => {
            currentFilter.dateFrom = null;
            currentFilter.dateTo = null;
            renderUI();
        });

        document.getElementById('start-auto-load').addEventListener('click', () => {
            const targetDateInput = document.getElementById('auto-load-target-date').value;

            if (!targetDateInput) {
                showNotification('⚠️ 목표 날짜를 선택해주세요.');
                return;
            }

            const [year, month, day] = targetDateInput.split('-').map(Number);
            const targetDate = new Date(year, month - 1, day, 0, 0, 0);

            const rows = document.querySelectorAll('[role="row"]');
            let oldestDate = null;

            for (let i = rows.length - 1; i >= 0; i--) {
                const dateCell = rows[i].querySelector('[class*="list-content-item--order-date"]');
                if (dateCell && dateCell.textContent.trim()) {
                    const dateStr = dateCell.textContent.trim();
                    oldestDate = parseDate(dateStr);
                    break;
                }
            }

            if (oldestDate && oldestDate <= targetDate) {
                showNotification('✅ 이미 목표 날짜까지의 데이터가 로딩되어 있습니다.');
                return;
            }

            document.getElementById('bithumb-export-panel').remove();
            autoLoadDataUntilDate(targetDate);
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            exportToCSV(searchFiltered);
            showNotification('CSV 파일이 다운로드되었습니다!');
        });

        document.getElementById('copy-stats').addEventListener('click', () => {
            const dateRangeText = currentFilter.dateFrom || currentFilter.dateTo
                ? `\n기간: ${currentFilter.dateFrom ? currentFilter.dateFrom.toLocaleDateString() : '시작'} ~ ${currentFilter.dateTo ? currentFilter.dateTo.toLocaleDateString() : '종료'}`
                : '';
            const text = `빗썸 거래 통계${dateRangeText}
━━━━━━━━━━━━━━━━━━━━
총 거래 건수: ${searchFiltered.length}건
총 정산금액: ${stats.totalSettlement.toLocaleString()}
총 수수료: ${stats.totalFee.toLocaleString()}
매수: ${stats.buyCount}건 / 매도: ${stats.sellCount}건
입금: ${stats.depositCount}건 / 출금: ${stats.withdrawCount}건

거래 유형별:
${Object.entries(stats.types).map(([type, data]) =>
                `  ${type}: ${data.count}건, ${data.settlement >= 0 ? '+' : ''}${data.settlement.toLocaleString()}`
            ).join('\n')}`;
            copyToClipboard(text);
        });

        document.getElementById('reset-filter').addEventListener('click', () => {
            currentFilter = {
                type: null,
                asset: null,
                search: '',
                searchInput: '',
                dateFrom: null,
                dateTo: null
            };
            renderUI();
        });

        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 6px 25px rgba(0,0,0,0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                const defaultShadows = {
                    'export-csv': '0 4px 15px rgba(102, 126, 234, 0.4)',
                    'copy-stats': '0 4px 15px rgba(240, 147, 251, 0.4)',
                    'reset-filter': '0 4px 15px rgba(79, 172, 254, 0.4)',
                    'search-btn': '0 4px 15px rgba(102, 126, 234, 0.4)',
                    'apply-date-filter': '0 4px 15px rgba(67, 233, 123, 0.4)',
                    'clear-date-filter': 'none',
                    'start-auto-load': '0 4px 15px rgba(245, 158, 11, 0.4)'
                };
                btn.style.boxShadow = defaultShadows[btn.id] || 'none';
            });
        });

        searchInput.addEventListener('focus', () => {
            searchInput.style.borderColor = '#667eea';
            searchInput.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
        });
        searchInput.addEventListener('blur', () => {
            searchInput.style.borderColor = '#e0e7ff';
            searchInput.style.boxShadow = 'none';
        });
    }

    const mainPanel = document.createElement('div');
    mainPanel.id = 'bithumb-export-panel';
    mainPanel.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            #bithumb-export-panel * {
                box-sizing: border-box;
            }
            #bithumb-export-panel::-webkit-scrollbar {
                width: 8px;
            }
            #bithumb-export-panel::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 10px;
            }
            #bithumb-export-panel::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
            }
        </style>
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); animation: fadeIn 0.3s ease-out;" id="overlay">
            <div style="background: linear-gradient(135deg, #f6f8fb 0%, #e9ecef 100%); width: 90%; max-width: 1200px; max-height: 90vh; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: fadeIn 0.3s ease-out;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <div>
                        <h2 style="margin: 0; color: white; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">📊 빗썸 거래 내역 분석</h2>
                        <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">총 ${trades.length}건의 거래 데이터</p>
                    </div>
                    <button id="close-panel" style="background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 20px; font-weight: bold; transition: all 0.3s; display: flex; align-items: center; justify-content: center;">×</button>
                </div>
                <div id="bithumb-export-panel-content" style="padding: 32px; overflow-y: auto; max-height: calc(90vh - 100px);"></div>
            </div>
        </div>
    `;

    document.body.appendChild(mainPanel);
    renderUI();

    document.getElementById('close-panel').addEventListener('click', () => {
        mainPanel.remove();
    });

    document.getElementById('overlay').addEventListener('click', (e) => {
        if (e.target.id === 'overlay') {
            mainPanel.remove();
        }
    });

    const closeBtn = document.getElementById('close-panel');
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.3)';
        closeBtn.style.transform = 'rotate(90deg)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
        closeBtn.style.transform = 'rotate(0deg)';
    });

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            mainPanel.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
})();
